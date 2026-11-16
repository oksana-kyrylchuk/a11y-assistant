// Open the side panel when the toolbar icon is clicked.
//
// This uses action.onClicked instead of
// sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) on purpose:
// with the declarative behavior the click opens the panel but does not grant
// activeTab, so the panel cannot inject scripts into the page.
chrome.action.onClicked.addListener((tab) => {
  // Must be called synchronously to stay inside the user gesture.
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error: unknown) => console.error(error))
})
