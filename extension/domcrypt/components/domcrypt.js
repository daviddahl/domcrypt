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
 * The Original Code is DOMCrypt PKI Code.
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

var log = LogFactory("*** DOMCrypt extension:");
var alertsService;

alertsService = Cc["@mozilla.org/alerts-service;1"].
                  getService(Ci.nsIAlertsService);

if (typeof alertsService.showAlertNotification == undefined) {
  // This is a Mac without growl/ Linux without libnotify, etc...
   alertsService = {
    showAlertNotification:
    function AS_showAlertNotification(aNull, aTitle, aText)
    {
      Services.console.logStringMessage("*** DOMCrypt: " + aTitle + " " + aText);
    }
  };
}

function notify(aTitle, aText)
{
  alertsService.showAlertNotification(null,
                                      aTitle,
                                      aText,
                                      false, "", null, "");
}

XPCOMUtils.defineLazyGetter(this, "cryptoSvc",
                            function (){
  Cu.import("resource://domcrypt/WeaveCrypto.js");
  return new WeaveCrypto();
});

XPCOMUtils.defineLazyGetter(this, "Addressbook",
  function (){
    Cu.import("resource://domcrypt/addressbookManager.js");
    return addressbook;
});

XPCOMUtils.defineLazyGetter(this, "promptSvc", function() {
  return Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
});

const PROMPT_TITLE_GENERATE = "Enter a passphrase";
const PROMPT_TEXT_GENERATE =
  "Enter a passphrase that will be used to keep your messages secure";
const PROMPT_TITLE_GENERATE_CONFIRM = "Confirm the passphrase";
const PROMPT_TEXT_GENERATE_CONFIRM =
  "Confirm you know the passphrase you just entered";
const PROMPT_TITLE_PASSPHRASE_NOT_CONFIRMED = "Passphrases do not match";
const PROMPT_TEXT_PASSPHRASE_NOT_CONFIRMED =
  "Error: The passphrase and confirmation do not match";
const PROMPT_TITLE_DECRYPT = "Enter Passphrase";
const PROMPT_TEXT_DECRYPT = "Enter Passphrase";

let BLANK_CONFIG_OBJECT = {
  default: {
    hashedPassphrase: null,
    created: null,
    privKey: null,
    pubKey: null,
    salt: null,
    iv: null
  }
};

let BLANK_CONFIG_OBJECT_STR = "{'default': {'hashedPassphrase': null,'created': null,'privKey': null,'pubKey': null,'salt': null,'iv': null}};";

function DOMCryptAPI(){

}

DOMCryptAPI.prototype = {

  classID:          Components.ID("{66af630d-6d6d-4d29-9562-9f1de90c1798}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),

  init: function DC_init(aWindow)
  {
    let self = this;
    this.pubKey = null;
    this.getConfigObj();
    this.window = XPCNativeWrapper.unwrap(aWindow);
    this.salt = cryptoSvc.generateRandomBytes(16);
    this.iv = cryptoSvc.generateRandomIV();

    let obj = {
      encrypt: self.encrypt.bind(self),
      decrypt: self.decrypt.bind(self),
      promptDecrypt: self.promptDecrypt.bind(self),
      generateKeyPair: self.beginGenerateKeyPair.bind(self),
      getPubKey: self.getPubKey.bind(self),
      getAddressbook: self.getAddressbook.bind(self)
    };

    return obj;
  },

  getAddressbook: function DAPI_getAddressbook()
  {
    // TODO: whitelist urls before giving access to the addressbook
    return Addressbook.getContactsObj();
  },

  encrypt: function DAPI_encrypt(aMsg, aPubKey)
  {
    if (!aPubKey) {
      // we do not need a public key arg if we are encrypting our own data
      if (!this.config.default.pubKey) {
        throw new Error("Encryption credentials missing. (No pubKey found)" );
      }
      aPubKey = this.config.default.pubKey;
    }
    if (!aMsg && !aPubKey) {
      throw new Error("Missing Arguments: aMsg and aPubKey are required");
    }

    var randomSymKey = cryptoSvc.generateRandomKey();
    var aIV = cryptoSvc.generateRandomIV();
    var cryptoMessage = cryptoSvc.encrypt(aMsg, randomSymKey, aIV);
    var wrappedKey = cryptoSvc.wrapSymmetricKey(randomSymKey, aPubKey);
    return { content: cryptoMessage, pubKey: aPubKey, wrappedKey: wrappedKey, iv: aIV };
  },

  decrypt: function DAPI_decrypt(aMsg, aPassphrase) {
    // aMsg is an object like this:
    // { content: |ENCRYPTED MESSAGE CONTENT|,
    //   wrappedKey: |SYMMETRIC WRAPPED KEY GENERATED AND RETURNED BY ENCRYPT()|,
    //   iv: |VECTOR CREATED FOR THIS MESSAGE'S ENCRYPTION|,
    //   pubKey: |PUBLIC KEY USED TO ENCRYPT THIS MESSGE|
    // }
    if (!this.config.default.privKey) {
      throw new Error("Your encryption credentials are missing. (No privKey found)");
    }

    var verify = cryptoSvc.verifyPassphrase(this.config.default.privKey,
                                            aPassphrase,
                                            this.config.default.salt,
                                            this.config.default.iv);

    var unwrappedKey = cryptoSvc.unwrapSymmetricKey(aMsg.wrappedKey,
                                                    this.config.default.privKey,
                                                    aPassphrase,
                                                    this.config.default.salt,
                                                    this.config.default.iv);

    var decryptedMsg = cryptoSvc.decrypt(aMsg.content, unwrappedKey, aMsg.iv);

    // get rid of the passphrase ASAP
    delete aPassphrase;
    // force garbage collection
    Cu.forceGC();

    return decryptedMsg;
  },

  promptDecrypt: function DAPI_promptDecrypt(aMsg)
  {
    // prompt for passphrase in a chrome context before decrypting message
    let passphrase = {};
    let prompt = promptSvc.promptPassword(this.window,
                                          PROMPT_TITLE_DECRYPT,
                                          PROMPT_TEXT_DECRYPT,
                                          passphrase, null, {value: false});
    if (passphrase.value) {
      return this.decrypt(aMsg, passphrase.value);
    }
    // Otherwise we should throw?
    throw new Error("No passphrase entered.");
  },

  getPubKey: function DAPI_getPubKey()
  {
    return this.config.default.pubKey;
  },

  configurationFile: function DAPI_configFile() {
    // get profile directory
    let file = Cc["@mozilla.org/file/directory_service;1"].
                 getService(Ci.nsIProperties).
                 get("ProfD", Ci.nsIFile);
    file.append(".domcrypt.json");

    if (!file.exists()) {
      file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0777);
    }
    return file;
  },

  writeConfigurationToDisk: function DAPI_writeConfigurationToDisk(aConfigObj)
  {
    if (!aConfigObj) {
      throw new Error("aConfigObj is null");
    }

    let data;

    try {
      if (typeof aConfigObj == "object") {
        // convert aConfigObj to JSON string
        data = JSON.stringify(aConfigObj);
      }
      else {
        data = aConfigObj;
      }

      let foStream = Cc["@mozilla.org/network/file-output-stream;1"].
                       createInstance(Ci.nsIFileOutputStream);
      let file = this.configurationFile();

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

  deleteConfiguration: function DAPI_deleteConfiguration()
  {
    this.writeConfigurationToDisk(BLANK_CONFIG_OBJECT);
  },

  config: BLANK_CONFIG_OBJECT,

  getConfigObj: function DAPI_getConfigObj()
  {
    let newConfig = false;
    try {
      // get file, convert to JSON
      let file = this.configurationFile();
      try {
        var str = this.getFileAsString(file);
      }
      catch (ex) {
        newConfig = true;
        var str = BLANK_CONFIG_OBJECT_STR;
      }
      let json = JSON.parse(str);
      this.config = json;
      this.pubKey = this.config.default.pubKey;
      if (newConfig) {
        this.writeConfigurationToDisk(this.config);
      }
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
    }
    return this.config;
  },

  getFileAsString: function DAPI_getFileAsString(aFile)
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
  },

  beginGenerateKeyPair: function DAPI_beginGenerateKeyPair()
  {
    let passphrase = {};
    let prompt = promptSvc.promptPassword(this.window,
                                          PROMPT_TITLE_GENERATE,
                                          PROMPT_TEXT_GENERATE,
                                          passphrase, null, {value: false});
    if (prompt && passphrase.value) {
      let passphraseConfirm = {};
      let prompt = promptSvc.promptPassword(this.window,
                                            PROMPT_TITLE_GENERATE_CONFIRM,
                                            PROMPT_TEXT_GENERATE_CONFIRM,
                                            passphraseConfirm,
                                            null, {value: false});
      if (prompt && passphraseConfirm.value &&
          (passphraseConfirm.value == passphrase.value)) {
        this.generateKeyPair(passphrase.value);
      }
      else {
        promptSvc.alert(this.window, PROMPT_TITLE_PASSPHRASE_NOT_CONFIRMED,
                        PROMPT_TEXT_PASSPHRASE_NOT_CONFIRMED);
      }
    }
  },

  generateKeyPair: function DAPI_generateKeyPair(passphrase)
  {
    var pubOut = {};
    var privOut = {};
    cryptoSvc.generateKeypair(passphrase, this.salt, this.iv,
                              pubOut, privOut);
    this.pubKey = pubOut.value;

    // TODO: make a backup of the existing config if it has a timestamp
    let previousConfigStr = JSON.stringify(this.config);

    // set memory config data from generateKeypair
    this.config.default.pubKey = pubOut.value;
    this.config.default.privKey = privOut.value;
    this.config.default.created = Date.now();
    this.config.default.hashedPassphrase = this.sha256(passphrase);
    this.config.default.iv = this.iv;
    this.config.default.salt = this.salt;

    // make a string of the config
    let strConfig = JSON.stringify(this.config);

    // write the new config to disk
    this.writeConfigurationToDisk(strConfig);

    // TODO: create an event  that can be listened for when the keyPair
    // is done being generated
    try {
      notify("Key Pair Generated", "");
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      Cu.reportError("Key Pair Generated - notification could not be sent");
    }
  },

  get setTimeout() {
    return this.window.ownerDocument.defaultView.setTimeout;
  },

  randomSymKey: function DAPI_randomSymKey(pubKey)
  {
    if(!pubKey){
      throw new Error("Public Key was not provided (to randomSymKey())");
    }
    return cryptoSvc.generateRandomKey();
  },

  sha256: function Weave_sha2(string) {
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
};

let NSGetFactory = XPCOMUtils.generateNSGetFactory([DOMCryptAPI]);
