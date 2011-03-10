/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DOMCrypt Addressbook Code.
 *
 * The Initial Developer of the Original Code is David Dahl.
 *
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Dahl <david@ddahl.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function LogFactory(aMessagePrefix)
{
  function log(aMessage) {
    var _msg = aMessagePrefix + " " + aMessage + "\n";
    dump(_msg);
  }
  return log;
}

var log = LogFactory("*** DOMCrypt Addressbook:");

const PROMPT_PUB_KEY_FOUND_BUTTON_LABEL = "Save Addressbook Entry";

let EXPORTED_SYMBOLS = ["addressbook"];

let AddressbookManager = {

  classID:          Components.ID("{66af630d-6d6d-4d29-9562-9f1de90c1799}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

  init: function AM_init()
  {
    this.getContactsObj();

    if (this.running) {
      return this;
    }

    Services.obs.addObserver(this, "content-document-global-created", false);
    Services.obs.addObserver(this, "quit-application-granted", false);
    this.running = true;
    return this;
  },

  running: false,

  observe: function AM_observe(aSubject, aTopic, aData)
  {
    if (aTopic == "final-ui-startup") {
      Services.obs.addObserver(this, "content-document-global-created", false);
    }
    if (aTopic == "content-document-global-created") {
      let self = this;
      // check if there is a public key in the document
      let window = XPCNativeWrapper.unwrap(aSubject);
      window.addEventListener("DOMContentLoaded", self.windowParser, false);
    }
    if (aTopic == "quit-application-granted") {
      Services.obs.removeObserver(this, "content-document-global-created");
    }
  },

  windowParser: function AM_makeWindowParseFunction(aEvent)
  {
    AddressbookManager.discoverAddressbookEntry(aEvent.target);
  },

  parseWindow: function AM_parseWindow(aDocument)
  {
    aDocument = XPCNativeWrapper.unwrap(aDocument);
    // look for an addressbook entry meta tag in the document
    let metaTags = aDocument.querySelectorAll("meta");
    for (let i = 0; i < metaTags.length; i++) {
      let node = metaTags[i];
      if (node.getAttribute("name") == "addressbook-entry") {
        try {
          let entryObj = {
            pubKey: node.getAttribute("pubkey"),
            handle: node.getAttribute("handle"),
            domain: node.getAttribute("domain"),
            date:   node.getAttribute("date")
          };
          return entryObj;
        }
        catch (ex) {
          Cu.reportError("DOMCrypt: Could not get Addressbook entry. " + ex);
        }
      }
    }
    return null;
  },

  discoverAddressbookEntry: function AM_discoverAddressbookEntry(aDocument)
  {
    let entry = this.parseWindow(aDocument);

    if (!entry) {
      return;
    }
    if (!entry.handle && !entry.domain && !entry.date && !entry.pubKey) {
      Cu.reportError("DOMCrypt Addressbook entry is malformed");
      return;
    }
    let idx = "@" + entry.domain + "/" + entry.handle;
    if (this.contacts[idx]) {
      // check if the key has changed
      if (parseInt(this.contacts[idx].date) == parseInt(entry.date)) {
        // key is the same, ignore published entry
        Cu.reportError("DOMCrypt: Addressbook entry already in storage");
        return;
      }
    }
    if (entry) {
      // show a notification telling the user about this discovered entry
      var xulWindow = aDocument.defaultView
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShell)
        .chromeEventHandler.ownerDocument.defaultView;
      let gBrowser = xulWindow.gBrowser;
      let docElem = xulWindow.document.documentElement;
      if (!docElem || docElem.getAttribute("windowtype") != "navigator:browser" ||
          !xulWindow.gBrowser) {
        // one last check to bail out
        return;
      }
      let browser = gBrowser.getBrowserForDocument(aDocument);
      var nb = gBrowser.getNotificationBox(browser);
      var notification = nb.getNotificationWithValue('addressbook-entry-found');
      if (notification) {
        notification.label = message;
      }
      else {
        let self = this;
        var buttons = [{
                         label: PROMPT_PUB_KEY_FOUND_BUTTON_LABEL,
                         accessKey: 'S',
                         popup: null,
                         callback:
                           function(){self.saveContactIntoAddressbook(entry);}
                       }];

        const priority = nb.PRIORITY_WARNING_MEDIUM;
        nb.appendNotification(idx + " has published a DOMCrypt Addressbook Entry on this page",
                              'addressbook-entry-found',
                              'chrome://global/skin/icons/Question.png',
                              priority,
                              buttons);
      }
    }
  },

  saveContactIntoAddressbook: function AM_saveContactIntoAddressbook(aContact)
  {
    // get .domcrypt_contacts.json if the data is not loaded
    if (!this.contacts) {
      this.getContactsObj();
    }
    // TODO: check to see if we have this one yet before saving as we might be
    // overwriting an old key we might want to hang on to
    let idx = "@" + aContact.domain + "/" + aContact.handle;

    this.contacts[idx] = aContact;
    // this.contacts[idx]['hash'] = sha2(aContact.pubKey); // no worky

    this.writeContactsToDisk();
  },

  removeContact: function AM_removeContact(aHandle)
  {
    // TODO: remove contact from this.contacts and JSON file
    // TODO: expose to DOM API
  },

  contactsFile: function AM_contactFile()
  {
    // get profile directory
    let file = Cc["@mozilla.org/file/directory_service;1"].
                 getService(Ci.nsIProperties).
                 get("ProfD", Ci.nsIFile);
    file.append(".domcrypt_contacts.json");

    if (!file.exists()) {
      file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0777);
      this.contactsFileCreated = Date.now();
    }
    return file;
  },

  writeContactsToDisk: function AM_writeContactsToDisk()
  {
    let data;

    try {
      // convert this.contacts to JSON string
      data = JSON.stringify(this.contacts);

      let foStream = Cc["@mozilla.org/network/file-output-stream;1"].
                       createInstance(Ci.nsIFileOutputStream);
      let file = this.contactsFile();

      // use 0x02 | 0x10 to open file for appending.
      foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);

      let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
                        createInstance(Ci.nsIConverterOutputStream);
      converter.init(foStream, "UTF-8", 0, 0);
      converter.writeString(data);
      converter.close();
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
    }
  },

  getContactsObj: function AM_getContactsObj()
  {
    let newContacts = false;
    let jsonObj;

    try {
      // get file, convert to JSON
      let file = this.contactsFile();
      if (this.contactsFileCreated) {
        this.contacts = {};
        this.writeContactsToDisk(this.contacts);
        this.contactsFileCreated = false;
      }
      else {
        var str = this.getFileAsString(file);
        jsonObj = JSON.parse(str);
        this.contacts = jsonObj;
      }
      return this.contacts;
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      return {};
    }
  },

  getFileAsString: function AM_getFileAsString(aFile)
  {
    if (!aFile.exists()) {
      throw new Error("File does not exist");
    }
    // read file data
    let data = "";
    let fstream = Cc["@mozilla.org/network/file-input-stream;1"].
                    createInstance(Ci.nsIFileInputStream);
    let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
                    createInstance(Ci.nsIConverterInputStream);
    fstream.init(aFile, -1, 0, 0);
    cstream.init(fstream, "UTF-8", 0, 0);

    let (str = {}) {
      let read = 0;
      do {
        read = cstream.readString(0xffffffff, str);
        data += str.value;
      } while (read != 0);
    };
    cstream.close();
    return data;
  }
};

function sha2(string) {
  // stolen from weave/util.js
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
    createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";

  let hasher = Cc["@mozilla.org/security/hash;1"]
    .createInstance(Ci.nsICryptoHash);
  hasher.init(hasher.SHA256);

  let data = converter.convertToByteArray(string, {});
  hasher.update(data, data.length);
  let rawHash = hasher.finish(false);

  // return the two-digit hexadecimal code for a byte
  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }

  let hash = [toHexString(rawHash.charCodeAt(i)) for (i in rawHash)].join("");
  return hash;
}

let Addressbook = AddressbookManager.init();

XPCOMUtils.defineLazyGetter(this, "addressbook",
  function (){
    return AddressbookManager.init();
});
