// TODO: think about when it's ok to discard stuff.
//       - when a tab disappears in some sense?
//       - when a new redirect clobbers an old one, in some sense?
//         - url or redirectUrl?  think about it.
// TODO: how to guarantee there's only one instance of this happening at a time?

// Per http://stackoverflow.com/questions/24369328/how-to-use-strict-mode-in-chrome-javascript-console,
// "The easiest way to use strict mode is to use an IIFE (Immediately invoked Function Expression).
(function()
{
  'use strict';
  //bar = 345; //ReferenceError: bar is not defined  (if uncommented, since strict mode)


  let verboseLevel = 2; // 0: nothing, 1: extension init and errors, 2: every significant action, 3: lots of details like headers

  if (verboseLevel >= 1) console.log("    in background.js");
  if (verboseLevel >= 1) console.log("      verboseLevel = "+EXACT(verboseLevel)+(verboseLevel<2?" (set to >=2 in source and reload extension to show flow graph of every request)":""));


  let redirectsThatHappened = new Map();

  let onBeforeRedirectListener = function(details) {
    if (verboseLevel >= 2) console.log("in onBeforeRedirect listener, tabId="+EXACT(details.tabId)+" requestId="+EXACT(details.requestId)+": "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode+" -> "+EXACT(details.redirectUrl));
    if (verboseLevel >= 3) console.log("  details = "+EXACT(details));

    let url = details.url;
    let redirectUrl = details.redirectUrl;
    let commonSuffixLength = 0;
    while (commonSuffixLength < url.length && commonSuffixLength < redirectUrl.length &&
           url.charAt(url.length - 1 - commonSuffixLength) === redirectUrl.charAt(redirectUrl.length - 1 - commonSuffixLength)) {
      commonSuffixLength++;
    }
    url = url.slice(0, url.length - commonSuffixLength);
    redirectUrl = redirectUrl.slice(0, redirectUrl.length - commonSuffixLength);

    const tabId = details.tabId;
    if (!redirectsThatHappened.has(tabId)) {
      redirectsThatHappened.set(tabId, []);
    }
    redirectsThatHappened.get(tabId).push({
        url: url,
        statusCode: details.statusCode,
        redirectUrl: redirectUrl,
    });

    if (verboseLevel >= 2) {
      for (let i = verboseLevel>=3 ? 0 : redirectsThatHappened.get(tabId).length-1; i < redirectsThatHappened.get(tabId).length; ++i) {
        console.log("  "+i+": "+EXACT(redirectsThatHappened.get(tabId)[i]));
      }
    }

    let answer = null;
    if (verboseLevel >= 2) console.log("out onBeforeRedirect listener, tabId="+EXACT(details.tabId)+" requestId="+EXACT(details.requestId)+": "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode+" -> "+EXACT(details.redirectUrl));
    return answer;
  };  // onBeforeRedirectListener

  chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirectListener, {urls:["<all_urls>"]}, ["responseHeaders"]);  // options: responseHeaders

  //
  // Define and install chrome.runtime listeners.
  //
  let onStartupOrOnInstalledListener = function() {
  };  // onStartupOrOnInstalledListener

  // happens on browser start
  // (and other cases? I think when a user profile is enabled that has the extension enabled)
  // (note, does not happen at all if manually enabled after browser start)
  chrome.runtime.onStartup.addListener(function() {
    if (verboseLevel >= 1) console.log("        in onStartup listener");
    onStartupOrOnInstalledListener();
    if (verboseLevel >= 1) console.log("        out onStartup listener");
  });
  // happens on Reload of extension
  chrome.runtime.onInstalled.addListener(function() {
    if (verboseLevel >= 1) console.log("        in onInstalled listener");
    onStartupOrOnInstalledListener();
    if (verboseLevel >= 1) console.log("        out onInstalled listener");
  });  // onInstalled listener
  // this might not be interesting, I don't know
  chrome.runtime.onMessage.addListener(function() {
    if (verboseLevel >= 1) console.log("        in onMessage listener");
    if (verboseLevel >= 1) console.log("        out onMessage listener");
  });  // onMessage listener

  if (true) {
    // Mess around with the extension icon and context menu.
    // https://stackoverflow.com/questions/19468429/add-contextmenu-items-to-a-chrome-extensions-browser-action-button
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
        title: "Reload extension",
        contexts: ["browser_action"],
        onclick: function() {
          console.log("%c%s", "color:red", "CALLING location.reload()");
          location.reload();
        },
    });
    chrome.contextMenus.create({
        title: "Open another \"background page\", in a tab.  Confusing.",
        contexts: ["browser_action"],
        onclick: function() {
          //open('chrome-extension://lbfjopbdnlacmcdochehdolkcipncehm/_generated_background_page.html');
          open('_generated_background_page.html');
        },
    });


    if (true) {
      let numClicks = 0;
      //chrome.browserAction.setBadgeBackgroundColor({color: 'blue'});
      //chrome.browserAction.setBadgeText({text: "ReRe"});
      chrome.browserAction.onClicked.addListener(function(tab) {
        if (verboseLevel >= 2) console.log("icon clicked, tab = ",tab);
        if (redirectsThatHappened.has(tab.id)) {
          const redirectsThisTab = redirectsThatHappened.get(tab.id);
          if (verboseLevel >= 2) console.log("  "+EXACT(redirectsThisTab.length)+" redirectsThisTab = "+EXACT(redirectsThisTab));
          let url = tab.url;
          for (let i = redirectsThisTab.length-1; i >= 0; --i) {
            const redirect = redirectsThisTab[i];
            if (url.startsWith(redirect.redirectUrl)) {
              if (verboseLevel >= 2) console.log("          {"+EXACT(redirect.redirectUrl)+" -> "+EXACT(redirect.url)+"}"+EXACT(url.slice(redirect.redirectUrl.length)));
              url = redirect.url + url.slice(redirect.redirectUrl.length);
            }
          }
          // TODO: how do I control whether it gets it from cache or not?
          chrome.tabs.update(tab.id, {url: url});
        }
      });
    }
  }

  if (true) {
    // Can I mess with the page?  Yup.
    // It shows up in chrome-extension://pebbhcjfokadbgbnlmogdkkaahmamnap/_generated_background_page.html, not sure how that's supposed to be used.
    if (verboseLevel >= 1) console.log("      adding something to body maybe");
    document.body.innerHTML += "Hello, I am a background page for the ReRedirect extension.  Open the developer console to see more.";
    if (verboseLevel >= 1) console.log("      added something to body maybe");
  }


  if (verboseLevel >= 1) console.log("    out background.js");
}()); // end of IIFE
