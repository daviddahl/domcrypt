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
 * The Original Code is DOMCrypt API code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  David Dahl <ddahl@mozilla.com>  (Original Author)
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

let Cu = Components.utils;
let Ci = Components.interfaces;
let Cc = Components.classes;
let Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function log(aMessage) {
  var _msg = "DOMCryptAPI: " + aMessage + "\n";
  dump(_msg);
}

XPCOMUtils.defineLazyGetter(this, "crypto", function (){
  Cu.import("resource://domcrypt/DOMCryptMethods.jsm");
  return DOMCryptMethods;
});

XPCOMUtils.defineLazyGetter(this, "promptSvc", function() {
  return Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
});

XPCOMUtils.defineLazyGetter(this, "Addressbook", function (){
    Cu.import("resource://domcrypt/addressbookManager.js");
    return addressbook;
});

/**
 * DOMCrypt/mozCipher API
 *
 * This is a shim (nsIDOMGlobalPropertyInitializer) object that wraps the
 * DOMCryptMethods.jsm 'crypto' object
 *
 * DOMCrypt's init method returns the API that is content JS accessible.
 *
 * DOMCryptAPI imports DOMCryptMethods, DOMCryptMethods generates the ChromeWorker
 * that runs all WeaveCrypto (NSS) functions off main thread via ctypes
 */

function DOMCryptAPI() {}

DOMCryptAPI.prototype = {

  classID: Components.ID("{66af630d-6d6d-4d29-9562-9f1de90c1798}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer,
                                         Ci.nsIObserver,]),

  sandbox: null,

  /**
   * We must free the sandbox and window references every time an
   * innerwindow is destroyed
   * TODO: must listen for back/forward events to reinstate the window object
   *
   * @param object aSubject
   * @param string aTopic
   * @param string aData
   *
   * @returns void
   */
  observe: function DA_observe(aSubject, aTopic, aData)
  {
    if (aTopic == "inner-window-destroyed") {
      let windowID = aSubject.QueryInterface(Ci.nsISupportsPRUint64).data;
      let innerWindowID = this.window.QueryInterface(Ci.nsIInterfaceRequestor).
                            getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
      if (windowID == innerWindowID) {
        crypto.shutdown();
        delete this.sandbox;
        delete this.window;
        Services.obs.removeObserver(this, "inner-window-destroyed");
      }
    }
  },

  /**
   * This method sets up the crypto API and returns the object that is
   * accessible from the DOM
   *
   * @param nsIDOMWindow aWindow
   * @returns object
   *          The object returned is the API object called 'window.mozCipher'
   */
  init: function DA_init(aWindow) {

    let self = this;

    this.window = XPCNativeWrapper.unwrap(aWindow);

    this.sandbox = Cu.Sandbox(this.window,
                              { sandboxPrototype: this.window, wantXrays: false });

    // we need a xul window reference for the DOMCryptMethods
    this.xulWindow = aWindow.QueryInterface(Ci.nsIDOMWindow)
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIDocShellTreeItem)
      .rootTreeItem
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindow)
      .QueryInterface(Ci.nsIDOMChromeWindow);

    crypto.setXULWindow(this.xulWindow);

    Services.obs.addObserver(this, "inner-window-destroyed", false);

    let api = {

      // "pk": Public Key encryption namespace
      pk: {
        encrypt: self.encrypt.bind(self),
        decrypt: self.promptDecrypt.bind(self),
        sign: self.sign.bind(self),
        verify: self.verify.bind(self),
        generateKeypair: self.beginGenerateKeypair.bind(self),
        getPublicKey: self.getPublicKey.bind(self),
        getAddressbook: self.getAddressbook.bind(self),
        __exposedProps__: {
          generateKeypair: "r",
          getPublicKey: "r",
          encrypt: "r",
          decrypt: "r",
          sign: "r",
          verify: "r",
        }
      },

      sym: {
        generateKey: self.generateSymKey.bind(self),
        wrapKey: self.wrapKey.bind(self),
        encrypt: self.symEncrypt.bind(self),
        decrypt: self.symDecrypt.bind(self),
        __exposedProps__: {
          generateKey: "r",
          wrapKey: "r",
          encrypt: "r",
          decrypt: "r",
        },
      },

      hash: {
        SHA256: self.SHA256.bind(self),
        __exposedProps__: {
          SHA256: "r",
        },
      },

      __exposedProps__: {
        pk: "r",
        sym: "r",
        hash: "r",
      },
    };

    return api;
  },

  getAddressbook: function DAPI_getAddressbook(aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("First argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    // TODO: whitelist urls before giving access to the addressbook
    let contacts = Addressbook.getContactsObj();
    crypto.getAddressbook(contacts, aCallback, this.sandbox);
  },

  // Symmetric API

  generateSymKey: function DA_generateSymKey(aCallback, aPublicKey)
  {
    // XXXddahl: should maybe have a time created/modified and SHA256 hash of the
    // public key for the utility of it
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("First argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    var pubKey;
    if (typeof aPublicKey == "string") {
      pubKey = aPublicKey;
    }
    else {
      pubKey = null;
    }
    crypto.generateSymKey(aCallback, pubKey, this.sandbox);
  },

  /**
   * re-wrap the symmetric key inside a CryptoObject to allow other
   * keypairs access to the encrypted content
   * A CryptoObject is either some encrypted data with associated wrapped symKey
   * or, just a symKey object
   *
   * @param object aCipherObject
   * @param string aPublicKey
   * @param function aCallback
   * @returns void
   */
  wrapKey: function DA_wrapKey(aCipherObject, aPublicKey, aCallback)
  {
    // XXXddahl: also accept an array of public keys in case we are
    // updating a single cipher object many times over?? Or create wrapKeys()??
    // unwrap, then re-wrap the cipher object's symmetric key with a new publicKey

    if ((!aCipherObject.iv) || (!aCipherObject.wrappedKey) ||
        (!aCipherObject.pubKey)) {
      // this is not a stand-alone key or a cipher object, reject it
      let exception =
        new Components.Exception("Invalid input: First argument is not a Symmetric Key or Cipher Object",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Third argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    // we don't re-encrypt anything, we just unwrap and then wrap the key
    crypto.wrapKey(aCipherObject, aPublicKey, aCallback, this.sandbox);
  },

  // aPublicKey is optional: the current user's pub key is used by default
  // to protect the symmetric key
  symEncrypt: function DA_symEncrypt(aPlainText, aCallback, aPublicKey)
  {
    // XXXddahl: add aSymmetricKey as an optional arg to allow for independent
    // key generation - it may also be that generateSymKey is unneeded as this
    // method is starting to look more complicated than wanted
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Second argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aPlainText == "string")) {
      let exception =
        new Components.Exception("First argument should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    var pubKey;
    if (typeof aPublicKey == "string") {
      pubKey = aPublicKey;
    }
    else {
      pubKey = null;
    }
    crypto.symEncrypt(aPlainText, pubKey, aCallback, this.sandbox);
  },

  symDecrypt: function DA_symDecrypt(aCipherObject, aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Second argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aCipherObject == "object")) {
      let exception =
        new Components.Exception("First argument should be a CipherObject",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.symDecrypt(aCipherObject, aCallback, this.sandbox);
  },

  /**
   * Prompt the enduser to create a keypair
   *
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  beginGenerateKeypair: function DA_beginGenerateKeypair(aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("First argument should be a function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    // this is a prompt-driven routine.
    // passphrase is typed in, confirmed, then the generation begins
    crypto.beginGenerateKeypair(aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.encrypt()
   *
   * @param string aPlainText
   *        A string that will be encrypted
   * @param string aPublicKey
   *        The public key of the recipient of the encrypted text
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  encrypt: function DA_encrypt(aPlainText, aPublicKey, aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Third argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    if (!(typeof aPlainText == "string") || !(typeof aPublicKey == "string")) {
      let exception =
        new Components.Exception("First and second arguments should be Strings",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.encrypt(aPlainText, aPublicKey, aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.decrypt()
   *
   * @param object aCipherMessage
   *        An object literal much like:
   *        { content:    <ENCRYPTED_STRING>,
   *          pubKey:     <RECIPIENT PUB_KEY>,
   *          wrappedKey: <WRAPPED SYM_KEY>,
   *          iv:         <INITIALIZATION VECTOR>
   *        }
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  promptDecrypt: function DA_promptDecrypt(aCipherMessage, aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Second argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    if (!(typeof aCipherMessage == "object")) {
      let exception =
        new Components.Exception("First argument should be a mozCipher Message Object",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    crypto.promptDecrypt(aCipherMessage, aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.getPublicKey()
   *
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  getPublicKey: function DA_getPublicKey(aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("First argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.getPublicKey(aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.sign()
   *
   * @param string aMessage
   *        The plaintext message before it is encrypted
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  sign: function DA_sign(aMessage, aCallback)
  {
    if (!(typeof aMessage == "string")) {
      let exception =
        new Components.Exception("First argument should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Second argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.sign(aMessage, aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.verify()
   *
   * @param string aMessage
   *        A plaintext decrypted message
   * @param string aSignature
   *        The signature of the encrypted message
   * @param string aPublicKey
   *        The recipient's public key
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  verify: function DA_verify(aMessage, aSignature, aPublicKey, aCallback)
  {
    if (!(typeof aMessage == "string")) {
      let exception =
        new Components.Exception("First argument (aMessage) should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aSignature == "string")) {
      let exception =
        new Components.Exception("Second argument (aSignature) should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aPublicKey == "string")) {
      let exception =
        new Components.Exception("Third argument (aPublicKey) should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Fourth argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.verify(aMessage, aSignature, aPublicKey, aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.verifyPassphrase()
   *
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  verifyPassphrase: function DA_verifyPassphrase(aCallback)
  {
    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("First argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.verifyPassphrase(aCallback, this.sandbox);
  },

  /**
   * A wrapper that calls DOMCryptMethods.SHA256()
   *
   * @param string aPlainText
   *        The plaintext string to be hashed
   * @param function aCallback
   *        This callback will run in the content sandbox when the operation
   *        is complete
   * @returns void
   */
  SHA256: function DA_SHA256(aPlainText, aCallback)
  {
    if (!(typeof aPlainText == "string")) {
      let exception =
        new Components.Exception("First argument (aPlainText) should be a String",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }

    if (!(typeof aCallback == "function")) {
      let exception =
        new Components.Exception("Second argument should be a Function",
                                 Cr.NS_ERROR_INVALID_ARG,
                                 Components.stack.caller);
      throw exception;
    }
    crypto.SHA256(aPlainText, aCallback, this.sandbox);
  },
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([DOMCryptAPI]);

