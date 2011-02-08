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

try {
  var alertsService = Cc["@mozilla.org/alerts-service;1"].
                        getService(Ci.nsIAlertsService);
  function notify(aTitle, aText)
  {
    alertsService.showAlertNotification(null,
                                        aTitle,
                                        aText,
                                        false, "", null, "");
  }
} 
catch (ex) {
  let notify = null;
}

XPCOMUtils.defineLazyGetter(this, "JSON", function() {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

XPCOMUtils.defineLazyGetter(this, "cryptoSvc",
                            function (){
  Cu.import("resource://domcrypt/WeaveCrypto.js");
  return new WeaveCrypto();
});

function DOMCryptAPI(){

}

DOMCryptAPI.prototype = {

  classID:          Components.ID("{66af630d-6d6d-4d29-9562-9f1de90c1798}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),

  init: function DC_init(aWindow)
  {
    log("*** Starting DOMCrypt... ");
    log("cryptoSvc: " + cryptoSvc);

    let self = this;
    
    this.window = aWindow;
    this.salt = cryptoSvc.generateRandomBytes(16);
    this.iv = cryptoSvc.generateRandomIV();

    return {
      encrypt: self.encrypt,
      decrypt: self.decrypt,
      generateKeyPair: self.generateKeyPair,
      pubKey: self.pubKey,
      privKey: self.privKey,
      salt: self.salt,
      iv: self.iv        
    };
  },
  
  encrypt: function DAPI_encrypt(aMsg, aPubKey) {
    if (!aMsg && !aPubKey) {
      throw new Error("Missing Arguments: aMessage and aPublicKey are Required");
    }
    var randomSymKey = cryptoSvc.generateRandomKey(); //this.randomSymKey(aPubKey);
    var aIV = cryptoSvc.generateRandomIV();
    var cryptoMessage = cryptoSvc.encrypt(aMsg, randomSymKey, aIV);
    var wrappedKey = cryptoSvc.wrapSymmetricKey(randomSymKey, aPubKey);
    return { content: cryptoMessage, symKey: randomSymKey, pubKey: aPubKey, wrapped_key: wrappedKey, iv: aIV };
  },

  decrypt: function DAPI_decrypt(aMsg, aPubKey, aCryptoObj) {

    var verify = cryptoSvc.verifyPassphrase(aCryptoObj.privKey,
                                            aCryptoObj.passphrase,
                                            aCryptoObj.aSalt,
                                            aCryptoObj.aIV);

    var unwrappedKey = cryptoSvc.unwrapSymmetricKey(aMsg.wrapped_key,
                                                    aCryptoObj.privKey,
                                                    aCryptoObj.passphrase,
                                                    aCryptoObj.aSalt,
                                                    aCryptoObj.aIV);

    var decryptedMsg = cryptoSvc.decrypt(aMsg.content, unwrappedKey, aMsg.iv);

    return decryptedMsg;
  },

  wrappedRandomSymKey: function DAPI_wrappedRandomSymKey(aSymKey, aPubKey)
  {
    return cryptoSvc.wrapSymmetricKey(aSymKey, aPubKey);
  },

  randomSymKey: function DAPI_randomSymKey(aPubKey)
  {
    if(!aPubKey){
      throw new Error("Public Key was not provided (to randomSymKey())");
    }
    var currentSymKey = cryptoSvc.generateRandomKey();
    return currentSymKey;
  },

  pubKey: null,

  privKey: null,

  orig_iv: null,
  
  orig_salt: null,
  
  generateKeyPair: function DAPI_generateKeyPair(passphrase)
  {
    var pubOut = {};
    var privOut = {};
    cryptoSvc.generateKeypair(passphrase, this.salt, this.iv,
                              pubOut, privOut);
    this.pubKey = pubOut.value;
    this.privKey = privOut.value;

    // TODO: create an event  that can be listened for when the keyPair
    // is done being generated
    if (notify) {
      notify("Key Pair Generated");
    } else {
      let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Ci.nsIPromptService);
      
      promptService.alert(this.window, "Key Pair Generated", "Key Pair Generated");
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
