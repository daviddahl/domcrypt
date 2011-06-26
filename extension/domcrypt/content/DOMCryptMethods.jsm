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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "promptSvc",
                                   "@mozilla.org/embedcomp/prompt-service;1",
                                   "nsIPromptService");

XPCOMUtils.defineLazyServiceGetter(this, "secretDecoderRing",
                                   "@mozilla.org/security/sdr;1",
                                   "nsISecretDecoderRing");

var PASSPHRASE_TTL = 3600000;

const CONFIG_FILE_PATH = ".mozCipher.json";
const PROFILE_DIR      = "ProfD";
const STRINGS_URI      = "chrome://domcrypt/locale/domcrypt.properties";;

XPCOMUtils.defineLazyGetter(this, "stringBundle", function () {
  return Services.strings.createBundle(STRINGS_URI);
});

/**
 * This string object keeps track of all of the string names used here
 */
const MOZ_CIPHER_STRINGS = {
  enterPassphraseTitle: "enterPassphraseTitle",
  enterPassphraseText: "enterPassphraseText",
  confirmPassphraseTitle: "confirmPassphraseTitle",
  confirmPassphraseText: "confirmPassphraseText",
  passphrasesDoNotMatchTitle: "passphrasesDoNotMatchTitle",
  passphrasesDoNotMatchText: "passphrasesDoNotMatchText",
  signErrorTitle: "signErrorTitle",
  signErrorMessage: "signErrorMessage",
  noPassphraseEntered: "noPassphraseEntered",
};

/**
 * Memoize and return all strings used by this JSM
 */
function _stringStorage(aName) { }

_stringStorage.prototype = {

  /**
   * Internally memoizes and gets the string via aName
   *
   * @param string aName
   * @returns string
   */
  getStr: function SS_getStr(aName) {
    if (MOZ_CIPHER_STRINGS[aName]) {
      if (this[aName]) {
        return this[aName];
      }
      else {
        this[aName] = stringBundle.GetStringFromName(aName);
        return this[aName];
      }
    }
    else {
      Cu.reportError("Cannot get " + aName + " from stringBundle");
      return "";
    }
  },
};

// Initialize the stringStorage object
var stringStorage = new _stringStorage();

/**
 * StringBundle shortcut function
 *
 * @param string aName
 * @returns string
 */
function getStr(aName)
{
  return stringStorage.getStr(aName);
}

function log(aMessage) {
  var _msg = "*** DOMCryptMethods: " + aMessage + "\n";
  dump(_msg);
}

var EXPORTED_SYMBOLS = ["DOMCryptMethods"];

// A new blank configuration object
var BLANK_CONFIG_OBJECT = {
  default: {
    created: null,
    privKey: null,
    pubKey: null,
    salt: null,
    iv: null
  }
};

// A blank configuration object as a string
var BLANK_CONFIG_OBJECT_STR = "{default: {created: null,privKey: null,pubKey: null,salt: null,iv: null}};";

// We use NSS for the crypto ops, which needs to be initialized before
// use. By convention, PSM is required to be the module that
// initializes NSS. So, make sure PSM is initialized in order to
// implicitly initialize NSS.
Cc["@mozilla.org/psm;1"].getService(Ci.nsISupports);

// We can call ChromeWorkers from this JSM via nsIWorkerFactory
XPCOMUtils.defineLazyGetter(this, "worker", function (){
  var workerFactory = Cc["@mozilla.org/threads/workerfactory;1"].
                        createInstance(Ci.nsIWorkerFactory);
  return workerFactory.newChromeWorker("domcrypt_worker.js");
});

const KEYPAIR_GENERATED   = "keypairGenerated";
const DATA_ENCRYPTED      = "dataEncrypted";
const DATA_DECRYPTED      = "dataDecrypted";
const MESSAGE_SIGNED      = "messageSigned";
const MESSAGE_VERIFIED    = "messageVerified";
const SYM_KEY_GENERATED   = "symKeyGenerated";
const SYM_ENCRYPTED       = "symEncrypted";
const SYM_DECRYPTED       = "symDecrypted";
const SYM_KEY_WRAPPED     = "symKeyWrapped";
const SHA256_COMPLETE     = "SHA256Complete";
const PASSPHRASE_VERIFIED = "passphraseVerified";
const WORKER_ERROR        = "error";

worker.onmessage = function DCM_worker_onmessage(aEvent) {
  switch (aEvent.data.action) {
  case KEYPAIR_GENERATED:
    Callbacks.handleGenerateKeypair(aEvent.data.keypairData);
    break;
  case DATA_ENCRYPTED:
    Callbacks.handleEncrypt(aEvent.data.cipherMessage);
    break;
  case DATA_DECRYPTED:
    Callbacks.handleDecrypt(aEvent.data.plainText);
    break;
  case MESSAGE_SIGNED:
    Callbacks.handleSign(aEvent.data.signature);
    break;
  case MESSAGE_VERIFIED:
    Callbacks.handleVerify(aEvent.data.verification);
    break;
  case SYM_KEY_GENERATED:
    Callbacks.handleGenerateSymKey(aEvent.data.wrappedKeyObject);
    break;
  case SYM_ENCRYPTED:
    Callbacks.handleSymEncrypt(aEvent.data.cipherObject);
    break;
  case SYM_DECRYPTED:
    Callbacks.handleSymDecrypt(aEvent.data.plainText);
    break;
  case SYM_KEY_WRAPPED:
    Callbacks.handleWrapSymKey(aEvent.data.cipherObject);
    break;
  case SHA256_COMPLETE:
    Callbacks.handleSHA256(aEvent.data.hashedString);
    break;
  case PASSPHRASE_VERIFIED:
    Callbacks.handleVerifyPassphrase(aEvent.data.verification);
  case WORKER_ERROR:
    if (aEvent.data.notify) {
      notifyUser(aEvent.data);
    }
  default:
    break;
  }
};

worker.onerror = function DCM_onerror(aError) {
  log("Worker Error: " + aError.message);
};

// Constants to describe all operations
const GENERATE_KEYPAIR  = "generateKeypair";
const ENCRYPT           = "encrypt";
const DECRYPT           = "decrypt";
const SIGN              = "sign";
const VERIFY            = "verify";
const VERIFY_PASSPHRASE = "verifyPassphrase";
const GENERATE_SYM_KEY  = "generateSymKey";
const SYM_ENCRYPT       = "symEncrypt";
const SYM_DECRYPT       = "symDecrypt";
const WRAP_SYM_KEY      = "wrapSymKey";
const GET_PUBLIC_KEY    = "getPublicKey";
const SHA256            = "SHA256";
const GET_ADDRESSBOOK   = "getAddressbook";
const INITIALIZE_WORKER = "init";

/**
 * DOMCryptMethods
 *
 * This Object handles all input from content scripts via the DOMCrypt
 * nsIDOMGlobalPropertyInitializer and sends calls to the Worker that
 * handles all NSS calls
 *
 * The basic work flow:
 *
 * A content script calls one of the DOMCrypt window API methods, at minimum,
 * a callback function is passed into the window API method.
 *
 * The window API method calls the corresponding method in this JSM
 * (DOMCryptMethods), which sets up the callback and sandbox.
 *
 * The DOMCryptMethod API calls into the ChromeWorker which initializes NSS and
 * provides the js-ctypes wrapper obejct which is a slightly edited and expanded
 * WeaveCrypto Object.
 *
 * The crypto operations are run in the worker, and the return value sent back to
 * the DOMCryptMethods object via a postMessage.
 *
 * DOMCryptMethods' onmessage chooses which callback to execute in the original
 * content window's sandbox.
 */
var DOMCryptMethods = {

  xullWindow: null,

  setXULWindow: function DCM_setXULWindow(aWindow)
  {
    this.xulWindow = aWindow;
  },

  /**
   * The config object that is created by reading the contents of
   * <profile>/.mozCipher.json
   */
  config: BLANK_CONFIG_OBJECT,

  /**
   * Initialize the DOMCryptMethods object: set the callback and
   * configuration objects
   *
   * @param Object aConfigObject
   * @param String aSharedObjectPath
   *        The path to the NSS shared object
   * @returns void
   */
  init: function DCM_init(aConfigObject, aSharedObjectPath)
  {
    this.config = aConfigObject;
    worker.postMessage({action: INITIALIZE_WORKER, nssPath: aSharedObjectPath});
  },

  /**
   * Remove all references to windows on window close or browser shutdown
   *
   * @returns void
   */
  shutdown: function DCM_shutdown()
  {
    worker.postMessage({ action: "shutdown" });

    this.sandbox = null;
    this.xulWindow = null;

    for (let prop in Callbacks) {
      Callbacks[prop].callback = null;
      Callbacks[prop].sandbox = null;
    }
    Callbacks = null;
  },

  callbacks: null,

  /////////////////////////////////////////////////////////////////////////
  // DOMCrypt API methods exposed via the nsIDOMGlobalPropertyInitializer
  /////////////////////////////////////////////////////////////////////////

  /**
   * Begin the generate keypair process
   *
   * 1. Prompt user for passphrase and confirm passphrase
   * 2. Pass the passphrase off to the worker to generate a keypair
   *
   * @returns void
   */
  beginGenerateKeypair: function DCM_beginGenerateKeypair(aCallback, aSandbox)
  {
    // TODO: check if the user already has a keypair and confirm they
    // would like to overwrite it

    Callbacks.register(GENERATE_KEYPAIR, aCallback, aSandbox);

    let passphrase = {};
    let prompt =
      promptSvc.promptPassword(Callbacks.generateKeypair.sandbox.window,
                               getStr("enterPassphraseTitle"),
                               getStr("enterPassphraseText"),
                               passphrase, null, { value: false });
    if (prompt && passphrase.value) {
      let passphraseConfirm = {};
      let prompt =
        promptSvc.promptPassword(Callbacks.generateKeypair.sandbox.window,
                                 getStr("confirmPassphraseTitle"),
                                 getStr("confirmPassphraseText"),
                                 passphraseConfirm,
                                 null, { value: false });
      if (prompt && passphraseConfirm.value &&
          (passphraseConfirm.value == passphrase.value)) {
        this.generateKeypair(passphrase.value);
      }
      else {
        promptSvc.alert(Callbacks.generateKeypair.sandbox.window,
                        getStr("passphrasesDoNotMatchTitle"),
                        getStr("passphrasesDoNotMatchText"));
      }
    }
  },

  /**
   * The internal 'generateKeypair' method that calls the worker
   *
   * @param string aPassphrase
   * @returns void
   */
  generateKeypair: function DCM_generateKeypair(aPassphrase)
  {
    worker.postMessage({ action: GENERATE_KEYPAIR, passphrase: aPassphrase });
    this.passphraseCache.encryptedPassphrase = secretDecoderRing.encryptString(aPassphrase);
    this.passphraseCache.lastEntered = Date.now();

  },

  /**
   * The internal 'getPublicKey' method
   *
   * @returns void
   */
  getPublicKey: function DCM_getPublicKey(aCallback, aSandbox)
  {
    Callbacks.register(GET_PUBLIC_KEY, aCallback, aSandbox);
    // TODO: need a gatekeeper function/prompt to allow access to your publicKey
    // TODO: looks like we can get this async via FileUtils
    Callbacks.handleGetPublicKey(this.config.default.pubKey);
  },

  /**
   * The internal 'encrypt' method which calls the worker to do the encrypting
   *
   * @param string aPlainText
   * @param string aPublicKey
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  encrypt: function DCM_encrypt(aPlainText, aPublicKey, aCallback, aSandbox)
  {
    Callbacks.register(ENCRYPT, aCallback, aSandbox);

    worker.postMessage({ action: ENCRYPT,
                         pubKey: aPublicKey,
                         plainText: aPlainText
                       });
  },

  /**
   * The internal 'decrypt' method which calls the worker to do the decrypting
   *
   * @param Object aCipherMessage
   * @param string aPassphrase
   * @returns void
   */
  decrypt:
  function DCM_decrypt(aCipherMessage, aPassphrase)
  {

    let userIV = secretDecoderRing.decryptString(this.config.default.iv);
    let userSalt = secretDecoderRing.decryptString(this.config.default.salt);
    let userPrivKey = this.config.default.privKey;

    worker.postMessage({ action: DECRYPT,
                         cipherMessage: aCipherMessage,
                         passphrase: aPassphrase,
                         privKey: userPrivKey,
                         salt: userSalt,
                         iv: userIV
                       });
  },

  passphraseCache: {
    encryptedPassphrase: null,
    lastEntered: null,
  },

  /**
   * Get the passphrase
   *
   * @returns string
   */
  get passphrase() {
    let passphrase = this.checkPassphraseCache();
    return passphrase;
  },

  /**
   * Check to see if the cached (encrypted) passphrase needs to be re-entered
   *
   * @returns void
   */
  checkPassphraseCache: function DCM_checkPassphraseCache()
  {
    let passphrase;
    // check if the passphrase has ever been entered
    if (!this.passphraseCache.encryptedPassphrase) {
      passphrase = this.enterPassphrase();
    }
    // check if the passphrase is outdated and needs to be re-entered
    else if ((Date.now() - this.passphraseCache.lastEntered) > PASSPHRASE_TTL) {
      passphrase = this.enterPassphrase();
    }
    else {
      return secretDecoderRing.decryptString(this.passphraseCache.encryptedPassphrase);
    }
    return passphrase;
  },

  /**
   * Enter the passphrase via a prompt
   *
   * @returns void
   */
  enterPassphrase: function DCM_enterPassphrase()
  {
    // accept the passphrase and store it in memory - encrypted via SDR
    // remember the passphrase for 1 hour
    let passphrase = {};
    let prompt = promptSvc.promptPassword(this.xulWindow,
                                          getStr("enterPassphraseTitle"),
                                          getStr("enterPassphraseText"),
                                          passphrase, null, { value: false });
    if (passphrase.value) {
      // TODO validate passphrase
      this.passphraseCache.encryptedPassphrase =
        secretDecoderRing.encryptString(passphrase.value);
      this.passphraseCache.lastEntered = Date.now();
      return passphrase.value;
    }
    else {
      throw new Error(getStr("noPassphraseEntered"));
    }
  },

  /**
   * Make sure the passphrase is the one used to generate the keypair
   *
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  verifyPassphrase: function DCM_verifyPassphrase(aCallback, aSandbox)
  {
    Callbacks.register(VERIFY_PASSPHRASE, aCallback, aSandbox);
    let passphrase = this.passphrase;
    let userPrivKey = this.config.default.privKey;
    let userIV = secretDecoderRing.decryptString(this.config.default.iv);
    let userSalt = secretDecoderRing.decryptString(this.config.default.salt);

    worker.postMessage({ action: VERIFY_PASSPHRASE,
                         privKey: userPrivKey,
                         passphrase: passphrase,
                         salt: userSalt,
                         iv: userIV
                       });
  },

  /**
   * Prompt the user for a passphrase to begin the decryption process
   *
   * @param object aCipherMessage
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  promptDecrypt: function DCM_promptDecrypt(aCipherMessage, aCallback, aSandbox)
  {
    Callbacks.register(DECRYPT, aCallback, aSandbox);
    let passphrase = this.passphrase;

    if (passphrase) {
      this.decrypt(aCipherMessage, passphrase);
      return;
    }

    throw new Error(getStr("noPassphraseEntered"));
  },

  /**
   * Front-end 'sign' method prompts user for passphrase then
   * calls the internal _sign message
   *
   * @param string aPlainTextMessage
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  sign: function DCM_sign(aPlainTextMessage, aCallback, aSandbox)
  {
    Callbacks.register(SIGN, aCallback, aSandbox);
    let passphrase = this.passphrase;
    if (passphrase) {
      this._sign(aPlainTextMessage, passphrase);
    }
    else {
      throw new Error(getStr("noPassphraseEntered"));
    }
  },

  /**
   * Internal backend '_sign' method calls the worker to do the actual signing
   *
   * @param string aPlainTextMessage
   * @param string aPassphrase
   * @returns void
   */
  _sign: function DCM__sign(aPlainTextMessage, aPassphrase)
  {
    let userIV = secretDecoderRing.decryptString(this.config.default.iv);
    let userSalt = secretDecoderRing.decryptString(this.config.default.salt);
    let userPrivKey = this.config.default.privKey;
    let hash = this._SHA256(aPlainTextMessage);

    worker.postMessage({ action: SIGN,
                         hash: hash,
                         passphrase: aPassphrase,
                         iv: userIV,
                         salt: userSalt,
                         privKey: userPrivKey
                       });
  },

  /**
   * The 'verify' method which calls the worker to do signature verification
   *
   * @param string aPlainTextMessage
   * @param string aSignature
   * @param string aPublicKey
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  verify:
  function
  DCM_verify(aPlainTextMessage, aSignature, aPublicKey, aCallback, aSandbox)
  {
    Callbacks.register(VERIFY, aCallback, aSandbox);
    let hash = this._SHA256(aPlainTextMessage);

    // Create a hash in the worker for verification
    worker.postMessage({ action: VERIFY,
                         hash: hash,
                         signature: aSignature,
                         pubKey: aPublicKey
                       });
  },

  generateSymKey: function DCM_generateSymKey(aCallback, aPublicKey, aSandbox)
  {
    Callbacks.register(GENERATE_SYM_KEY, aCallback, aSandbox);

    var pubKey;
    if (!aPublicKey) {
      pubKey = this.config.default.pubKey;
    }
    else {
      pubKey = aPublicKey;
    }

    worker.postMessage({ action: GENERATE_SYM_KEY,
                         pubKey: pubKey
                       });
  },

  wrapKey: function DCM_wrapKey(aCipherObject, aPublicKey, aCallback, aSandbox)
  {
    // unwrap then re-wrap the symmetric key inside aCipherObject, return a new
    // cipherObject that can be unlocked by another keypair
    Callbacks.register(WRAP_SYM_KEY, aCallback, aSandbox);

    let passphrase = this.passphrase;
    var userIV = secretDecoderRing.decryptString(this.config.default.iv);
    var userSalt = secretDecoderRing.decryptString(this.config.default.salt);
    var userPrivKey = this.config.default.privKey;

    worker.postMessage({ action: WRAP_SYM_KEY,
                         cipherObject: aCipherObject,
                         iv: userIV,
                         salt: userSalt,
                         privKey: userPrivKey,
                         passphrase: passphrase,
                         pubKey: aPublicKey
                       });
  },

  /**
   * SymEncrypt (symmetric)
   * @param string aPlaintext
   * @param string aPublicKey
   * @param function aCallback
   * @param sandbox aSandbox
   * @returns void
   */
  symEncrypt: function DCM_SymEncrypt(aPlainText, aPublicKey, aCallback, aSandbox)
  {
    Callbacks.register(SYM_ENCRYPT, aCallback, aSandbox);

    var pubKey;
    if (!aPublicKey) {
      pubKey = this.config.default.pubKey;
    }
    else {
      pubKey = aPublicKey;
    }

    worker.postMessage({ action: SYM_ENCRYPT,
                         plainText: aPlainText,
                         pubKey: pubKey
                       });
  },

  symDecrypt:
  function DCM_SymDecrypt(aCipherObject, aCallback, aSandbox)
  {
    var passphrase = this.passphrase; // this getter will throw if nothing entered

    var userIV = secretDecoderRing.decryptString(this.config.default.iv);
    var userSalt = secretDecoderRing.decryptString(this.config.default.salt);
    var userPrivKey = this.config.default.privKey;

    Callbacks.register(SYM_DECRYPT, aCallback, aSandbox);

    worker.postMessage({ action: SYM_DECRYPT,
                         cipherObject: aCipherObject,
                         iv: userIV,
                         salt: userSalt,
                         privKey: userPrivKey,
                         passphrase: passphrase
                       });
  },

  /**
   * This is the internal SHA256 hash function, it does the actual hashing
   *
   * @param string aPlainText
   * @returns string
   */
  _SHA256: function DCM__SHA256(aPlainText)
  {
    // stolen from weave/util.js
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                      createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    let hasher = Cc["@mozilla.org/security/hash;1"].
                   createInstance(Ci.nsICryptoHash);
    hasher.init(hasher.SHA256);

    let data = converter.convertToByteArray(aPlainText, {});
    hasher.update(data, data.length);
    let rawHash = hasher.finish(false);

    // return the two-digit hexadecimal code for a byte
    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    let hash = [toHexString(rawHash.charCodeAt(i)) for (i in rawHash)].join("");
    return hash;
  },

  /**
   * SHA256 API hash function
   * This is synchronous for the time being. TODO: wrap NSS SHA* functions
   * with js-ctypes so we can run in a worker
   *
   * @param string aPlainTextMessage
   * @returns void
   */
  SHA256: function DCM_SHA256(aPlainText, aCallback, aSandbox)
  {
    Callbacks.register(SHA256, aCallback, aSandbox);
    let hash = this._SHA256(aPlainText);
    let callback = Callbacks.makeSHA256Callback(hash);
    let sandbox = Callbacks.SHA256.sandbox;
    sandbox.importFunction(callback, "SHA256Callback");
    Cu.evalInSandbox("SHA256Callback();", sandbox, "1.8", "DOMCrypt", 1);
  },

  getAddressbook: function DCM_getAddressbook(aAddressbook, aCallback, aSandbox)
  {
    // XXX: we are faking async here
    Callbacks.register(GET_ADDRESSBOOK, aCallback, aSandbox);
    let callback = Callbacks.makeGetAddressbookCallback(aAddressbook);
    let sandbox = Callbacks.getAddressbook.sandbox;
    sandbox.importFunction(callback, "getAddressbookCallback");
    Cu.evalInSandbox("getAddressbookCallback();", sandbox, "1.8", "DOMCrypt", 1);
  },


  /**
   * Get the configuration file from the filesystem.
   * The file is a JSON file in the user's profile named ".mozCipher.json"
   * @param boolean aFileCreated
   * @returns nsIFile
   */
  configurationFile: function DCM_configFile(aFileCreated)
  {
    // get profile directory
    let file = FileUtils.getFile(PROFILE_DIR, [CONFIG_FILE_PATH], true);
    if (!file.exists()) {
      file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      aFileCreated.value = true;
    }
    else {
      aFileCreated.value = false;
    }
    return file;
  },

  /**
   * write an updated or new configuration to <profile>/.mozCipher.json
   *
   * @param Object aConfigObj
   * @returns void
   */
  writeConfigurationToDisk: function DCM_writeConfigurationToDisk(aConfigObj)
  {
    if (!aConfigObj) {
      throw new Error("aConfigObj is null");
    }

    let data;

    if (typeof aConfigObj == "object") {
      // convert aConfigObj to JSON string
      data = JSON.stringify(aConfigObj);
    }
    else {
      data = aConfigObj;
    }
    let foStream = Cc["@mozilla.org/network/file-output-stream;1"].
      createInstance(Ci.nsIFileOutputStream);
    let fileCreated = {};
    let file = this.configurationFile(fileCreated);

    // use 0x02 | 0x10 to open file for appending.
    foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
    let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
      createInstance(Ci.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(data);
    converter.close();
  },

  config: BLANK_CONFIG_OBJECT,
};

/**
 * Creates a unique callback registry for each DOMCryptMethods object
 *
 * @returns Object
 */
function GenerateCallbackObject() { }

GenerateCallbackObject.prototype = {

  encrypt: { callback: null, sandbox: null },

  decrypt: { callback: null, sandbox: null },

  generateKeypair: { callback: null, sandbox: null },

  getPublicKey: { callback: null, sandbox: null },

  sign: { callback: null, sandbox: null },

  verify: { callback: null, sandbox: null },

  verifyPassphrase: { callback: null, sandbox: null },

  generateSymKey: { callback: null, sandbox: null },

  symEncrypt: { callback: null, sandbox: null },

  symDecrypt: { callback: null, sandbox: null },

  wrapSymKey: { callback: null, sandbox: null },

  SHA256: { callback: null, sandbox: null },

  getAddressbook: { callback: null, sandbox: null },

  sandbox: null,

  /**
   * Register a callback for any API method
   *
   * @param string aLabel
   * @param function aCallback
   * @param Object aSandbox
   * @returns void
   */
  register: function GCO_register(aLabel, aCallback, aSandbox)
  {
    // we need a 'fall back' sandbox for prompts, etc. when we are unsure what
    // method is in play
    this.sandbox = aSandbox;

    this[aLabel].callback = aCallback;
    this[aLabel].sandbox = aSandbox;
  },

  /**
   * wrap the content-provided script in order to make it easier
   * to import and run in the sandbox
   *
   * @param string aPubKey
   * @returns function
   */
  makeGenerateKeypairCallback:
  function DA_makeGenerateKeypairCallback(aPubKey)
  {
    let self = this;
    let callback = function generateKeypair_callback()
                   {
                     self.generateKeypair.callback(aPubKey);
                   };
    return callback;
  },

  /**
   * Wraps the content callback script, imports it into the sandbox and
   * calls it in the sandbox
   * @param Object aKeypair
   * @returns void
   */
  handleGenerateKeypair: function GCO_handleGenerateKeypair(aKeypairData)
  {
    // set memory config data from generateKeypair
    DOMCryptMethods.config.default.pubKey = aKeypairData.pubKey;
    DOMCryptMethods.config.default.privKey = aKeypairData.privKey;
    DOMCryptMethods.config.default.created = aKeypairData.created;
    DOMCryptMethods.config.default.iv =
      secretDecoderRing.encryptString(aKeypairData.iv);
    DOMCryptMethods.config.default.salt =
      secretDecoderRing.encryptString(aKeypairData.salt);

    // make a string of the config
    let strConfig = JSON.stringify(DOMCryptMethods.config);
    // write the new config to disk
    DOMCryptMethods.writeConfigurationToDisk(strConfig);
    // XXXddahl: This function is not working properly
    // writeConfigObjectToDisk(strConfig);

    let sandbox = this.generateKeypair.sandbox;
    let callback = this.makeGenerateKeypairCallback(aKeypairData.pubKey);
    sandbox.importFunction(callback, "generateKeypairCallback");
    Cu.evalInSandbox("generateKeypairCallback();", sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Create the callback that will be called after getting the publicKey
   *
   * @param string aPublicKey
   * @returns void
   */
  makeGetPublicKeyCallback: function GCO_makeGetPublicKeyCallback(aPublicKey)
  {
    let self = this;
    let callback = function getPublicKey_callback()
                   {
                     self.getPublicKey.callback(aPublicKey);
                   };
    return callback;
  },

  /**
   * Wraps the content callback script which deals with getting the publicKey
   *
   * @param string aPublicKey
   * @returns void
   */
  handleGetPublicKey: function GCO_handleGetPublicKey(aPublicKey)
  {
    let callback = this.makeGetPublicKeyCallback(aPublicKey);
    let sandbox = this.getPublicKey.sandbox;
    sandbox.importFunction(callback, "getPublicKeyCallback");
    Cu.evalInSandbox("getPublicKeyCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * wrap the content-provided encrypt callback script in order to make it easier
   * to import and run in the sandbox
   *
   * @param Object aCipherMessage
   * @returns JS function
   */
  makeEncryptCallback:
  function DA_encryptCallback(aCipherMessage)
  {
    let self = this;
    let callback = function encrypt_callback()
                   {
                     self.encrypt.callback(aCipherMessage);
                   };
    return callback;
  },

  /**
   * Wraps the content callback script which deals with encrypted message objects
   *
   * @param Object aCipherMessage
   * @returns void
   */
  handleEncrypt: function GCO_handleEncrypt(aCipherMessage)
  {
    let callback = this.makeEncryptCallback(aCipherMessage);
    let sandbox = this.encrypt.sandbox;
    sandbox.importFunction(callback, "encryptCallback");
    Cu.evalInSandbox("encryptCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * wrap the content-provided decrypt callback script in order to make it easier
   * to import and run in the sandbox
   *
   * @param string aPlainText
   * @returns JS function
   */
  makeDecryptCallback:
  function DA_decryptCallback(aPlainText)
  {
    let self = this;
    let callback = function decrypt_callback()
                   {
                     self.decrypt.callback(aPlainText);
                   };
    return callback;
  },

  /**
   * Wraps the content callback script which deals with the decrypted string
   *
   * @param string aPlainText
   * @returns void
   */
  handleDecrypt: function GCO_handleDecrypt(aPlainText)
  {
    let callback = this.makeDecryptCallback(aPlainText);
    let sandbox = this.decrypt.sandbox;
    sandbox.importFunction(callback, "decryptCallback");
    Cu.evalInSandbox("decryptCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Wraps the content callback script which deals with the signature
   *
   * @param string aSignature
   * @returns void
   */
  makeSignCallback: function GCO_makeSignCallback(aSignature)
  {
    let self = this;
    let callback = function sign_callback()
                   {
                     self.sign.callback(aSignature);
                   };
    return callback;
  },

  /**
   * Executes the signature callback function in the sandbox
   *
   * @param string aSignature
   * @returns void
   */
  handleSign: function GCO_handleSign(aSignature)
  {
    let callback = this.makeSignCallback(aSignature);
    let sandbox = this.sign.sandbox;
    sandbox.importFunction(callback, "signCallback");
    Cu.evalInSandbox("signCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Wraps the content callback script which deals with the signature verification
   *
   * @param boolean aVerification
   * @returns void
   */
  makeVerifyCallback: function GCO_makeVerifyCallback(aVerification)
  {
    let self = this;
    let callback = function verify_callback()
                   {
                     self.verify.callback(aVerification);
                   };
    return callback;
  },

  /**
   * Executes the verification callback function in the sandbox
   *
   * @param boolean aVerification
   * @returns void
   */
  handleVerify: function GCO_handleVerify(aVerification)
  {
    let callback = this.makeVerifyCallback(aVerification);
    let sandbox = this.verify.sandbox;
    sandbox.importFunction(callback, "verifyCallback");
    Cu.evalInSandbox("verifyCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Executes the generateSymKey callback function in the sandbox
   *
   * @param boolean aWrappedSymKey
   * @returns void
   */
  makeGenerateSymKeyCallback:
  function GCO_makeGenerateSymKeyCallback(aWrappedSymKeyObj)
  {
    let self = this;
    let callback = function genSymKey_callback()
                   {
                     self.generateSymKey.callback(aWrappedSymKeyObj);
                   };
    return callback;
  },

  /**
   * Executes the generateSymKey callback function in the sandbox
   *
   * @param string aWrappedSymKey
   * @returns void
   */
  handleGenerateSymKey: function GCO_handleGenerateSymKey(aWrappedSymKeyObj)
  {
    let callback = this.makeGenerateSymKeyCallback(aWrappedSymKeyObj);
    let sandbox = this.generateSymKey.sandbox;
    sandbox.importFunction(callback, "generateSymKeyCallback");
    Cu.evalInSandbox("generateSymKeyCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Wraps the SymEncrypt callback function in the sandbox
   *
   * @param object aCipherObject
   * @returns void
   */
  makeSymEncryptCallback:
  function GCO_makeSymEncryptCallback(aCipherObject)
  {
    let self = this;
    let callback = function makeSymEncrypt_callback()
                   {
                     self.symEncrypt.callback(aCipherObject);
                   };
    return callback;
  },

  /**
   * Executes the SymEncrypt callback function in the sandbox
   *
   * @param object aCipherObject
   * @returns void
   */
  handleSymEncrypt: function GCO_handleSymEncryptCallback(aCipherObject)
  {
    let callback = this.makeSymEncryptCallback(aCipherObject);
    let sandbox = this.symEncrypt.sandbox;
    sandbox.importFunction(callback, "symEncryptCallback");
    Cu.evalInSandbox("symEncryptCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },



  /**
   * Wraps the SymDecrypt callback function in the sandbox
   *
   * @param string aPlainText
   * @returns void
   */
  makeSymDecryptCallback:
  function GCO_makeSymDecryptCallback(aPlainText)
  {
    let self = this;
    let callback = function makeSymDecrypt_callback()
                   {
                     self.symDecrypt.callback(aPlainText);
                   };
    return callback;
  },

  /**
   * Executes the SymDecrypt callback function in the sandbox
   *
   * @param string aPlainText
   * @returns void
   */
  handleSymDecrypt: function GCO_handleSymDecrypt(aPlainText)
  {
    let callback = this.makeSymDecryptCallback(aPlainText);
    let sandbox = this.symDecrypt.sandbox;
    sandbox.importFunction(callback, "symDecryptCallback");
    Cu.evalInSandbox("symDecryptCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },




  /**
   * Wraps the wrapSymKey callback function in the sandbox
   *
   * @param object aCipherObject
   * @returns void
   */
  makeWrapSymKeyCallback:
  function GCO_makeWrapSymKeyCallback(aCipherObject)
  {
    let self = this;
    let callback = function makeWrapSymKey_callback()
                   {
                     self.wrapSymKey.callback(aCipherObject);
                   };
    return callback;
  },

  /**
   * Executes the wrapSymKey callback function in the sandbox
   *
   * @param object aCipherObject
   * @returns void
   */
  handleWrapSymKey: function GCO_handleWrapSymKey(aCipherObject)
  {
    let callback = this.makeWrapSymKeyCallback(aCipherObject);
    let sandbox = this.wrapSymKey.sandbox;
    sandbox.importFunction(callback, "wrapSymKeyCallback");
    Cu.evalInSandbox("wrapSymKeyCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },

  /**
   * Wraps the content callback script which deals with SHA256 hashing
   *
   * @param string aHash
   * @returns void
   */
  makeSHA256Callback: function GCO_makeSHA256Callback(aHash)
  {
    let callback = function hash256_callback()
                   {
                     this.SHA256.callback(aHash);
                   };
    return callback.bind(this);
    // Note: we don't need a handleSHA256Callback function as there is
    // no round trip to the worker yet, we are using the callback in the
    // same manner in order to mock an async API for the time being
  },

  makeGetAddressbookCallback: function GCO_makeGetAddressbookCallback(aAddressbook)
  {
    let callback = function _callback()
                   {
                     this.getAddressbook.callback(aAddressbook);
                   };
    return callback.bind(this);
    // Note: we don't need a handleGetAddressbookCallback function as there is
    // no round trip to the worker yet, we are using the callback in the
    // same manner in order to mock an async API for the time being
  },

  /**
   * Wraps the content callback script which deals with passphrase verification
   *
   * @param boolean aVerification
   * @returns void
   */
  makeVerifyPassphraseCallback:
  function GCO_makeVerifyPassphraseCallback(aVerification)
  {
    let self = this;
    let callback = function verify_callback()
                   {
                     self.verifyPassphrase.callback(aVerification);
                   };
    return callback;
  },

  /**
   * Executes the verifyPassphrase callback function in the sandbox
   *
   * @param boolean aVerification
   * @returns void
   */
  handleVerifyPassphrase:
  function GCO_handleVerifyPassphrase(aVerification)
  {
    let callback = this.makeVerifyPassphraseCallback(aVerification);
    let sandbox = this.verifyPassphrase.sandbox;
    sandbox.importFunction(callback, "verifyPassphraseCallback");
    Cu.evalInSandbox("verifyPassphraseCallback();",
                     sandbox, "1.8", "DOMCrypt", 1);
  },
};


var Callbacks = new GenerateCallbackObject();

/**
 * Initialize the DOMCryptMethods object by getting the configuration object
 * and creating the callbacks object
 * @param outparam aDOMCrypt
 * @returns void
 */
function initializeDOMCrypt()
{
  // Full path to NSS via js-ctypes
  let path = Services.dirsvc.get("GreD", Ci.nsILocalFile);
  let libName = ctypes.libraryName("nss3"); // platform specific library name
  path.append(libName);
  let fullPath = path.path;

  let fileCreated = {};
  let file = DOMCryptMethods.configurationFile(fileCreated);

  NetUtil.asyncFetch(file, function(inputStream, status) {
    if (!Components.isSuccessCode(status)) {
      throw new Error("Cannot access DOMCrypt configuration file");
    }

    var data;
    if (fileCreated.value) {
      data = JSON.stringify(BLANK_CONFIG_OBJECT);
      writeConfigObjectToDisk(data, function writeCallback (status) {
        if (!Components.isSuccessCode(status)) {
          throw new Error("Cannot write config object file to disk");
        }
        let configObj = JSON.parse(data);
        DOMCryptMethods.init(configObj, fullPath);
      });
    }
    else {
      data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      let configObj = JSON.parse(data);
      DOMCryptMethods.init(configObj, fullPath);
    }
  });
}

/**
 * Write the configuration to disk
 *
 * @param string aData
 * @param function aCallback
 * @returns void
 */
function writeConfigObjectToDisk(aData, aCallback)
{
  let fileCreated = {};
  let file = DOMCryptMethods.configurationFile(fileCreated);

  let ostream = Cc["@mozilla.org/network/file-output-stream;1"].
                  createInstance(Ci.nsIFileOutputStream);

  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                    createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let istream = converter.convertToInputStream(aData);

  NetUtil.asyncCopy(istream, ostream, aCallback);
}

initializeDOMCrypt();
