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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Justin Dolske <dolske@mozilla.com> (original author)
 *  David Dahl <ddahl@mozilla.com>
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

/**
 * NOTE
 *
 * The WeaveCrypto object in this file was originally pulled from hg.mozilla.org
 *
 * http://hg.mozilla.org/mozilla-central/ \
 * raw-file/d0c40fc38702/services/crypto/modules/WeaveCrypto.js
 *
 * WeaveCrypto's API as it was released in Firefox 4 was reduced in scope due
 * to Sync's move to J-Pake, hence the need for this more complete version.
 *
 * This version has the additional APIs 'sign' and 'verify' and has been
 * edited for use in a ChromeWorker.
 *
 */

var DEBUG = false;

function log(aMessage) {
  if (!DEBUG){
    return;
  }
  var _msg = "domcrypt_worker: " + " " + aMessage + "\n";
  dump(_msg);
}

const GENERATE_KEYPAIR  = "generateKeypair";
const ENCRYPT           = "encrypt";
const DECRYPT           = "decrypt";
const SIGN              = "sign";
const VERIFY            = "verify";
const GENERATE_SYM_KEY  = "generateSymKey";
const SYM_ENCRYPT       = "symEncrypt";
const SYM_DECRYPT       = "symDecrypt";
const WRAP_SYM_KEY      = "wrapSymKey";
const VERIFY_PASSPHRASE = "verifyPassphrase";
const SHUTDOWN          = "shutdown";
const INITIALIZE        = "init";

onmessage = function domcryptWorkerOnMessage(aEvent)
{
  let result, cipherObject;

  switch(aEvent.data.action) {
  case INITIALIZE:
    // try to open the library through its name only
    try {
      WeaveCrypto.initNSS(aEvent.data.libName);
    }
    // if this fails we need to provide the full path
    catch (ex) {
      WeaveCrypto.initNSS(aEvent.data.fullPath);
    }
    break;
  case GENERATE_KEYPAIR:
    result = WeaveCryptoWrapper.generateKeypair(aEvent.data.passphrase);
    postMessage({ keypairData: result, action: "keypairGenerated" });
    break;
  case ENCRYPT:
    result = WeaveCryptoWrapper.encrypt(aEvent.data.plainText, aEvent.data.pubKey);
    postMessage({ cipherMessage: result, action: "dataEncrypted" });
    break;
  case DECRYPT:
    let cipherMessage = {
      content: aEvent.data.cipherContent,
      wrappedKey: aEvent.data.cipherWrappedKey,
      pubKey: aEvent.data.cipherPubKey,
      iv: aEvent.data.cipherIV
    };
    result = WeaveCryptoWrapper.decrypt(cipherMessage,
                                        aEvent.data.passphrase,
                                        aEvent.data.privKey,
                                        aEvent.data.salt,
                                        aEvent.data.iv);

    postMessage({ plainText: result, action: "dataDecrypted" });
    break;
  case SIGN:
    result = WeaveCryptoWrapper.sign(aEvent.data.hash,
                                     aEvent.data.passphrase,
                                     aEvent.data.privKey,
                                     aEvent.data.iv,
                                     aEvent.data.salt);

    postMessage({ signature: result, action: "messageSigned" });
    break;
  case VERIFY:
    result = WeaveCryptoWrapper.verify(aEvent.data.hash,
                                       aEvent.data.signature,
                                       aEvent.data.pubKey);

    postMessage({ verification: result, action: "messageVerified" });
    break;
  case GENERATE_SYM_KEY:
    result = WeaveCryptoWrapper.generateSymKey(aEvent.data.pubKey);
    postMessage({ wrappedKeyObject: { wrappedKey: result.wrappedKey,
                                      pubKey: result.pubKey,
                                      iv: result.iv },
                  action: "symKeyGenerated"
                });
    break;
  case SYM_ENCRYPT:
    result =
      WeaveCryptoWrapper.symEncrypt(aEvent.data.plainText, aEvent.data.pubKey);
    postMessage({ cipherObject: { cipherText: result.cipherText,
                                  wrappedKey: result.wrappedKey ,
                                  pubKey: aEvent.data.pubKey,
                                  iv: result.iv },
                  action: "symEncrypted"
                });
    break;
  case SYM_DECRYPT:
    cipherObject = {
      wrappedKey: aEvent.data.cipherWrappedKey,
      pubKey: aEvent.data.cipherPubKey,
      cipherText: aEvent.data.cipherText,
      iv: aEvent.data.cipherIV
    };
    result =
      WeaveCryptoWrapper.symDecrypt(cipherObject,
                                    aEvent.data.privKey,
                                    aEvent.data.passphrase,
                                    aEvent.data.salt,
                                    aEvent.data.iv);

    postMessage({ plainText: result, action: "symDecrypted" });
    break;
  case WRAP_SYM_KEY:
    let cipherText = null;
    if (aEvent.data.cipherText) {
      cipherText = aEvent.data.cipherText;
    }
    cipherObject = {
      wrappedKey: aEvent.data.cipherWrappedKey,
      pubKey: aEvent.data.cipherPubKey,
      cipherText: cipherText,
      iv: aEvent.data.cipherIV
    };
    result = WeaveCryptoWrapper.wrapSymKey(cipherObject,
                                           aEvent.data.pubKey,
                                           aEvent.data.privKey,
                                           aEvent.data.passphrase,
                                           aEvent.data.salt,
                                           aEvent.data.iv);

    postMessage({ action: "symKeyWrapped", cipherObject: result });
    break;
  case VERIFY_PASSPHRASE:
    result = WeaveCryptoWrapper.verifyPassphrase(aEvent.data.privKey,
                                                 aEvent.data.passphrase,
                                                 aEvent.data.salt,
                                                 aEvent.data.iv);

    postMessage({ verification: result, action: "passphraseVerified" });
    break;
  case SHUTDOWN:
    WeaveCrypto.shutdown();
  default:
    break;
  }
};

/**
 * WeaveCryptoWrapper
 *
 * Wrap the WeaveCrypto API in a more elegant way. This is very similar to the
 * original DOMCrypt extension code
 *
 */
var WeaveCryptoWrapper = {

  /**
   * generateKeypair
   *
   * Create a KeyPair for general purpose PKI
   *
   * @param string aPassphrase
   *        The passphrase used to generate a keypair
   * @returns object
   *          The object returned looks like:
   *          { action:  "keypairGenerated",
   *            pubKey:  <PUBLIC KEY>,
   *            privKey: <PRIVATE KEY>,
   *            salt:    <SALT>,
   *            iv:      <INITIALIZATION VECTOR>,
   *            created: <DATE CREATED>
   *          }
   */
  generateKeypair: function WCW_generateKeypair(aPassphrase)
  {
    var pubOut = {};
    var privOut = {};

    try {
      var salt = WeaveCrypto.generateRandomBytes(16);
      var iv = WeaveCrypto.generateRandomIV();

      WeaveCrypto.generateKeypair(aPassphrase, salt, iv, pubOut, privOut);
      let results = { action: "keypairGenerated",
                      pubKey: pubOut.value,
                      privKey: privOut.value,
                      salt: salt,
                      iv: iv,
                      created: Date.now()
                    };
      return results;
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw(ex);
    }
  },

  /**
   * encrypt
   *
   * Encrypt data with a public key
   *
   * @param string aPlainText
   *        The plain text that will be encrypted
   * @param string aPublicKey
   *        The recipient's base64 encoded public key
   * @returns Object
   *          A 'message' object:
   *          { content:    <ENCRYPTED_STRING>,
   *            pubKey:     <RECIPIENT PUB_KEY>,
   *            wrappedKey: <WRAPPED SYM_KEY>,
   *            iv:         <INITIALIZATION VECTOR>
   *          }
   */
  encrypt: function WCW_encrypt(aPlainText, aPublicKey)
  {
    if (!aPlainText && !aPublicKey) {
      throw new Error("Missing Arguments: aPlainText and aPublicKey are required");
    }
    try {
      var randomSymKey = WeaveCrypto.generateRandomKey();
      var aIV = WeaveCrypto.generateRandomIV();
      var cryptoMessage = WeaveCrypto.encrypt(aPlainText, randomSymKey, aIV);
      var wrappedKey = WeaveCrypto.wrapSymmetricKey(randomSymKey, aPublicKey);

      return { content: cryptoMessage, pubKey: aPublicKey, wrappedKey: wrappedKey, iv: aIV };
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw ex;
    }
  },

  /**
   * decrypt
   *
   * Decrypt encrypted data with a private key
   *
   * @param object aCipherMessage
   *         An object literal much like:
   *         { content:    <ENCRYPTED_STRING>,
   *           pubKey:     <RECIPIENT PUB_KEY>,
   *           wrappedKey: <WRAPPED SYM_KEY>,
   *           iv:         <INITIALIZATION VECTOR>
   *         }
   * @param string aPassphrase
   *        The plain text passphrase used when the private key was generated
   * @param string aPrivateKey
   *        The base64 encoded private key string
   * @param string aSalt
   *        The salt used when the key pair was generated
   * @param string aIV
   *        The IV used when the keypair was generated
   * @returns string
   *          The decrypted message
   */
  decrypt:
  function WCW_decrypt(aCipherMessage, aPassphrase, aPrivateKey, aSalt, aIV)
  {
    try {
      var verify = WeaveCrypto.verifyPassphrase(aPrivateKey,
                                                aPassphrase,
                                                aSalt,
                                                aIV);

      var unwrappedKey = WeaveCrypto.unwrapSymmetricKey(aCipherMessage.wrappedKey,
                                                        aPrivateKey,
                                                        aPassphrase,
                                                        aSalt,
                                                        aIV);

      var decryptedMsg = WeaveCrypto.decrypt(aCipherMessage.content,
                                             unwrappedKey, aCipherMessage.iv);

      return decryptedMsg;
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw(ex);
    }
    finally {
      // get rid of the passphrase
      delete aPassphrase;
      delete aPrivateKey;
    }
  },

  /**
   * Cryptographically sign a message
   *
   * @param string aHash
   *        A SHA256 hash of the plain text message
   * @param string aPassphrase
   *        The sender's passphrase used to generate her keypair
   * @param string aPrivateKey
   *        The sender's base64 encoded private key
   * @param string aIV
   *        The IV used to generate the sender's keypair
   * @param string aSalt
   *        The salt used to generate the sender's keypair
   * @returns string
   *          A base64 encoded signature string
   */
  sign: function WCW_sign(aHash, aPassphrase, aPrivateKey, aIV, aSalt)
  {
    var signature;
    try {
      signature = WeaveCrypto.sign(aPrivateKey, aIV, aSalt, aPassphrase, aHash);
      return signature;
    }
    catch (ex) {
      postMessage({ action: "error", method: "sign", error: ex, notify: true });
      throw ex;
    }
    finally {
      delete aPrivateKey;
      delete aPassphrase;
      delete aIV;
      delete aSalt;
    }
  },

  /**
   * Verify a signature was created by the sender
   *
   * @param string aHash
   *        A SHA256 hash of the decrypted message
   * @param string aSignature
   *        A base64 encoded signature string
   * @param string aPublicKey
   *        The sender's base 64 encoded public key
   * @returns boolean
   */
  verify: function WCW_verify(aHash, aSignature, aPublicKey)
  {
    try {
      let results = WeaveCrypto.verify(aPublicKey, aSignature, aHash);

      if (results)
        return true;

      return false;
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw ex;
    }
  },

  // XXXddahl: perhaps we need a 're-wrap sym key' method to pass the key and data along?

  generateSymKey: function WCW_generateSymKey(aPublicKey)
  {
    var randomSymKey = WeaveCrypto.generateRandomKey();
    var IV = WeaveCrypto.generateRandomIV();

    // wrap the symkey
    var wrappedKey = WeaveCrypto.wrapSymmetricKey(randomSymKey, aPublicKey);
    return { wrappedKey: wrappedKey, iv: IV, pubKey: aPublicKey };
  },

  symEncrypt: function WCW_symEncrypt(aPlainText, aPublicKey)
  {
    // create a randomSymKey
    var randomSymKey = WeaveCrypto.generateRandomKey();
    var IV = WeaveCrypto.generateRandomIV();

    // encrypt
    var cryptoMessage = WeaveCrypto.encrypt(aPlainText, randomSymKey, IV);

    // wrap the symkey
    var wrappedKey = WeaveCrypto.wrapSymmetricKey(randomSymKey, aPublicKey);

    // return the cipherObject
    return { cipherText: cryptoMessage, wrappedKey: wrappedKey, iv: IV, pubKey: aPublicKey };
  },

  symDecrypt:
  function WCW_symDecrypt(aCipherObject, aPrivateKey, aPassphrase, aSalt, aIV)
  {
    // decrypt symmetric-encrypted data - need the privKey
    try {
      var verify = WeaveCrypto.verifyPassphrase(aPrivateKey,
                                                aPassphrase,
                                                aSalt,
                                                aIV);

      var unwrappedKey = WeaveCrypto.unwrapSymmetricKey(aCipherObject.wrappedKey,
                                                        aPrivateKey,
                                                        aPassphrase,
                                                        aSalt,
                                                        aIV);

      var decryptedMsg = WeaveCrypto.decrypt(aCipherObject.cipherText,
                                             unwrappedKey, aCipherObject.iv);

      return decryptedMsg;
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw(ex);
    }
    finally {
      // get rid of the passphrase, etc
      delete aPassphrase;
      delete aPrivateKey;
    }
  },

  /**
   * re-wrap the symmetric key property of either a symmetric key cipher object or
   * an encrypted data cipher object
   * @param object aCipherObject
   * @param string aPublicKey
   * @param string aPrivateKey
   * @param string aPassphrase
   * @param string aSalt
   * @param string aIV
   * @returns object
   */
  wrapSymKey:
  function
  WCW_wrapSymKey(aCipherObject, aPublicKey, aPrivateKey, aPassphrase, aSalt, aIV)
  {
    try {
      var verify = WeaveCrypto.verifyPassphrase(aPrivateKey,
                                                aPassphrase,
                                                aSalt,
                                                aIV);

      var unwrappedKey = WeaveCrypto.unwrapSymmetricKey(aCipherObject.wrappedKey,
                                                        aPrivateKey,
                                                        aPassphrase,
                                                        aSalt,
                                                        aIV);

      // wrap the key with aPublicKey
      var wrappedKey = WeaveCrypto.wrapSymmetricKey(unwrappedKey, aPublicKey);

      var cipherObj;

      // if there is no cipherText property, we are returning a symKey only
      if (aCipherObject.cipherText) {
        return { cipherText: aCipherObject.cipherText, iv: aCipherObject.iv, wrappedKey: wrappedKey, pubKey: aPublicKey };
      }

      return { iv: aCipherObject.iv, wrappedKey: wrappedKey, pubKey: aPublicKey };
    }
    catch (ex) {
      log(ex);
      log(ex.stack);
      throw(ex);
    }
    finally {
      // get rid of the passphrase, etc
      delete aPassphrase;
      delete aPrivateKey;
      delete unwrappedKey;
    }
  },

  /**
   * Verify the passphrase a user provides is the passphrase used when
   * the keypair was generated
   *
   * @param string aPassphrase
   *        The plain text passphrase to be verified
   * @param string aPrivateKey
   *        The user's base64 encoded private key
   * @param string aSalt
   *        The salt used when the keypair was generated
   * @param string aIV
   *        The IV used when the keypair was generated
   * @returns boolean
   */
  verifyPassphrase:
  function WCW_verifyPassphrase(aPrivateKey, aPassphrase, aSalt, aIV)
  {
    return WeaveCrypto.verifyPassphrase(aPrivateKey, aPassphrase, aSalt, aIV);
  },
};

/**
 * The WeaveCrypto changes I have made are minimal:
 * 1. Removed any calls into Cc/Ci/Cr, etc.
 * 2. added WeaveCrypto.sign() (PK11_Sign)
 * 3. added WeaveCrypto.verify() (PK11_Verify)
 *
 * WeaveCrypto (js-ctypes iteration) was coded and reviewed in this bug:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=513798
 *
 */

const DES_EDE3_CBC = 156; // http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#253
const AES_128_CBC  = 184; // http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#296
const AES_192_CBC  = 186; // http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#298
const AES_256_CBC  = 188; // http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#300
const EC = null; // need to figure out which EC algo to use
// http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#318
// recommended EC algs: http://www.nsa.gov/business/programs/elliptic_curve.shtml
// http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/util/secoidt.h#346
// SEC_OID_SECG_EC_SECP256K1       = 219,
// /* SEC_OID_SECG_EC_SECP256R1 is SEC_OID_ANSIX962_EC_PRIME256V1 */
// SEC_OID_SECG_EC_SECP384R1       = 220,
// SEC_OID_SECG_EC_SECP521R1       = 221,

var WeaveCrypto = {
  debug      : false,
  nss        : null,
  nss_t      : null,

  log : function (message) {
    if (!this.debug)
      return;
    dump("WeaveCrypto: " + message + "\n");
  },

  shutdown : function WC_shutdown()
  {
    this.log("closing nsslib");
    this.nsslib.close();
  },

  fullPathToLib: null,

  initNSS : function WC_initNSS(aNSSPath) {
    // Open the NSS library.
    this.fullPathToLib = aNSSPath;
    // XXX really want to be able to pass specific dlopen flags here.
    var nsslib;
    nsslib = ctypes.open(this.fullPathToLib);

    this.nsslib = nsslib;
    this.log("Initializing NSS types and function declarations...");

    this.nss = {};
    this.nss_t = {};

    // nsprpub/pr/include/prtypes.h#435
    // typedef PRIntn PRBool; --> int
    this.nss_t.PRBool = ctypes.int;
    // security/nss/lib/util/seccomon.h#91
    // typedef enum
    this.nss_t.SECStatus = ctypes.int;
    // security/nss/lib/softoken/secmodt.h#59
    // typedef struct PK11SlotInfoStr PK11SlotInfo; (defined in secmodti.h)
    this.nss_t.PK11SlotInfo = ctypes.void_t;
    // security/nss/lib/util/pkcs11t.h
    this.nss_t.CK_MECHANISM_TYPE = ctypes.unsigned_long;
    this.nss_t.CK_ATTRIBUTE_TYPE = ctypes.unsigned_long;
    this.nss_t.CK_KEY_TYPE       = ctypes.unsigned_long;
    this.nss_t.CK_OBJECT_HANDLE  = ctypes.unsigned_long;
    // security/nss/lib/softoken/secmodt.h#359
    // typedef enum PK11Origin
    this.nss_t.PK11Origin = ctypes.int;
    // PK11Origin enum values...
    this.nss.PK11_OriginUnwrap = 4;
    // security/nss/lib/softoken/secmodt.h#61
    // typedef struct PK11SymKeyStr PK11SymKey; (defined in secmodti.h)
    this.nss_t.PK11SymKey = ctypes.void_t;
    // security/nss/lib/util/secoidt.h#454
    // typedef enum
    this.nss_t.SECOidTag = ctypes.int;
    // security/nss/lib/util/seccomon.h#64
    // typedef enum
    this.nss_t.SECItemType = ctypes.int;
    // SECItemType enum values...
    this.nss.SIBUFFER = 0;
    // security/nss/lib/softoken/secmodt.h#62 (defined in secmodti.h)
    // typedef struct PK11ContextStr PK11Context;
    this.nss_t.PK11Context = ctypes.void_t;
    // Needed for SECKEYPrivateKey struct def'n, but I don't think we need to actually access it.
    this.nss_t.PLArenaPool = ctypes.void_t;
    // security/nss/lib/cryptohi/keythi.h#45
    // typedef enum
    this.nss_t.KeyType = ctypes.int;
    // security/nss/lib/softoken/secmodt.h#201
    // typedef PRUint32 PK11AttrFlags;
    this.nss_t.PK11AttrFlags = ctypes.unsigned_int;
    // security/nss/lib/util/secoidt.h#454
    // typedef enum
    this.nss_t.SECOidTag = ctypes.int;
    // security/nss/lib/util/seccomon.h#83
    // typedef struct SECItemStr SECItem; --> SECItemStr defined right below it
    this.nss_t.SECItem = ctypes.StructType(
      "SECItem", [{ type: this.nss_t.SECItemType },
                  { data: ctypes.unsigned_char.ptr },
                  { len : ctypes.int }]);
    // security/nss/lib/softoken/secmodt.h#65
    // typedef struct PK11RSAGenParamsStr --> def'n on line 139
    this.nss_t.PK11RSAGenParams = ctypes.StructType(
      "PK11RSAGenParams", [{ keySizeInBits: ctypes.int },
                           { pe : ctypes.unsigned_long }]);
    // security/nss/lib/cryptohi/keythi.h#233
    // typedef struct SECKEYPrivateKeyStr SECKEYPrivateKey; --> def'n right above it
    this.nss_t.SECKEYPrivateKey = ctypes.StructType(
      "SECKEYPrivateKey", [{ arena:        this.nss_t.PLArenaPool.ptr  },
                           { keyType:      this.nss_t.KeyType          },
                           { pkcs11Slot:   this.nss_t.PK11SlotInfo.ptr },
                           { pkcs11ID:     this.nss_t.CK_OBJECT_HANDLE },
                           { pkcs11IsTemp: this.nss_t.PRBool           },
                           { wincx:        ctypes.voidptr_t            },
                           { staticflags:  ctypes.unsigned_int         }]);
    // security/nss/lib/cryptohi/keythi.h#78
    // typedef struct SECKEYRSAPublicKeyStr --> def'n right above it
    this.nss_t.SECKEYRSAPublicKey = ctypes.StructType(
      "SECKEYRSAPublicKey", [{ arena:          this.nss_t.PLArenaPool.ptr },
                             { modulus:        this.nss_t.SECItem         },
                             { publicExponent: this.nss_t.SECItem         }]);
    // security/nss/lib/cryptohi/keythi.h#189
    // typedef struct SECKEYPublicKeyStr SECKEYPublicKey; --> def'n right above it
    this.nss_t.SECKEYPublicKey = ctypes.StructType(
      "SECKEYPublicKey", [{ arena:      this.nss_t.PLArenaPool.ptr    },
                          { keyType:    this.nss_t.KeyType            },
                          { pkcs11Slot: this.nss_t.PK11SlotInfo.ptr   },
                          { pkcs11ID:   this.nss_t.CK_OBJECT_HANDLE   },
                          { rsa:        this.nss_t.SECKEYRSAPublicKey } ]);
    // XXX: "rsa" et al into a union here!
    // { dsa: SECKEYDSAPublicKey },
    // { dh:  SECKEYDHPublicKey },
    // { kea: SECKEYKEAPublicKey },
    // { fortezza: SECKEYFortezzaPublicKey },
    // { ec:  SECKEYECPublicKey } ]);
    // security/nss/lib/util/secoidt.h#52
    // typedef struct SECAlgorithmIDStr --> def'n right below it
    this.nss_t.SECAlgorithmID = ctypes.StructType(
      "SECAlgorithmID", [{ algorithm:  this.nss_t.SECItem },
                         { parameters: this.nss_t.SECItem }]);
    // security/nss/lib/certdb/certt.h#98
    // typedef struct CERTSubjectPublicKeyInfoStrA --> def'n on line 160
    this.nss_t.CERTSubjectPublicKeyInfo = ctypes.StructType(
      "CERTSubjectPublicKeyInfo", [{ arena:            this.nss_t.PLArenaPool.ptr },
                                   { algorithm:        this.nss_t.SECAlgorithmID  },
                                   { subjectPublicKey: this.nss_t.SECItem         }]);


    // security/nss/lib/util/pkcs11t.h
    this.nss.CKK_RSA = 0x0;
    this.nss.CKM_RSA_PKCS_KEY_PAIR_GEN = 0x0000;
    this.nss.CKM_AES_KEY_GEN           = 0x1080;
    this.nss.CKA_ENCRYPT = 0x104;
    this.nss.CKA_DECRYPT = 0x105;
    this.nss.CKA_UNWRAP  = 0x107;

    // security/nss/lib/softoken/secmodt.h
    this.nss.PK11_ATTR_SESSION   = 0x02;
    this.nss.PK11_ATTR_PUBLIC    = 0x08;
    this.nss.PK11_ATTR_SENSITIVE = 0x40;

    // security/nss/lib/util/secoidt.h
    this.nss.SEC_OID_HMAC_SHA1            = 294;
    this.nss.SEC_OID_PKCS1_RSA_ENCRYPTION = 16;


    // security/nss/lib/pk11wrap/pk11pub.h#286
    // SECStatus PK11_GenerateRandom(unsigned char *data,int len);
    this.nss.PK11_GenerateRandom = nsslib.declare("PK11_GenerateRandom",
                                                  ctypes.default_abi, this.nss_t.SECStatus,
                                                  ctypes.unsigned_char.ptr, ctypes.int);
    // security/nss/lib/pk11wrap/pk11pub.h#74
    // PK11SlotInfo *PK11_GetInternalSlot(void);
    this.nss.PK11_GetInternalSlot = nsslib.declare("PK11_GetInternalSlot",
                                                   ctypes.default_abi, this.nss_t.PK11SlotInfo.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#73
    // PK11SlotInfo *PK11_GetInternalKeySlot(void);
    this.nss.PK11_GetInternalKeySlot = nsslib.declare("PK11_GetInternalKeySlot",
                                                      ctypes.default_abi, this.nss_t.PK11SlotInfo.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#328
    // PK11SymKey *PK11_KeyGen(PK11SlotInfo *slot,CK_MECHANISM_TYPE type, SECItem *param, int keySize,void *wincx);
    this.nss.PK11_KeyGen = nsslib.declare("PK11_KeyGen",
                                          ctypes.default_abi, this.nss_t.PK11SymKey.ptr,
                                          this.nss_t.PK11SlotInfo.ptr, this.nss_t.CK_MECHANISM_TYPE,
                                          this.nss_t.SECItem.ptr, ctypes.int, ctypes.voidptr_t);

    // SIGNING API //////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////

    // security/nss/pk11wrap/pk11pub.h#682
    // int PK11_SignatureLength(SECKEYPrivateKey *key);
    this.nss.PK11_SignatureLen = nsslib.declare("PK11_SignatureLen",
                                                ctypes.default_abi,
                                                ctypes.int,
                                                this.nss_t.SECKEYPrivateKey.ptr);

    // security/nss/pk11wrap/pk11pub.h#684
    // SECStatus PK11_Sign(SECKEYPrivateKey *key, SECItem *sig, SECItem *hash);
    this.nss.PK11_Sign = nsslib.declare("PK11_Sign",
                                        ctypes.default_abi,
                                        this.nss_t.SECStatus,
                                        this.nss_t.SECKEYPrivateKey.ptr,
                                        this.nss_t.SECItem.ptr,
                                        this.nss_t.SECItem.ptr);

    // security/nss/pk11wrap/pk11pub.h#687
    // SECStatus PK11_Verify(SECKEYPublicKey *key, SECItem *sig, SECItem *hash, void *wincx);
    this.nss.PK11_Verify = nsslib.declare("PK11_Verify",
                                          ctypes.default_abi,
                                          this.nss_t.SECStatus,
                                          this.nss_t.SECKEYPublicKey.ptr,
                                          this.nss_t.SECItem.ptr,
                                          this.nss_t.SECItem.ptr,
                                          ctypes.voidptr_t);
    // END SIGNING API
    //////////////////////////////////////////////////////////////////////////

    // security/nss/lib/pk11wrap/pk11pub.h#477
    // SECStatus PK11_ExtractKeyValue(PK11SymKey *symKey);
    this.nss.PK11_ExtractKeyValue = nsslib.declare("PK11_ExtractKeyValue",
                                                   ctypes.default_abi, this.nss_t.SECStatus,
                                                   this.nss_t.PK11SymKey.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#478
    // SECItem * PK11_GetKeyData(PK11SymKey *symKey);
    this.nss.PK11_GetKeyData = nsslib.declare("PK11_GetKeyData",
                                              ctypes.default_abi, this.nss_t.SECItem.ptr,
                                              this.nss_t.PK11SymKey.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#278
    // CK_MECHANISM_TYPE PK11_AlgtagToMechanism(SECOidTag algTag);
    this.nss.PK11_AlgtagToMechanism = nsslib.declare("PK11_AlgtagToMechanism",
                                                     ctypes.default_abi, this.nss_t.CK_MECHANISM_TYPE,
                                                     this.nss_t.SECOidTag);
    // security/nss/lib/pk11wrap/pk11pub.h#270
    // int PK11_GetIVLength(CK_MECHANISM_TYPE type);
    this.nss.PK11_GetIVLength = nsslib.declare("PK11_GetIVLength",
                                               ctypes.default_abi, ctypes.int,
                                               this.nss_t.CK_MECHANISM_TYPE);
    // security/nss/lib/pk11wrap/pk11pub.h#269
    // int PK11_GetBlockSize(CK_MECHANISM_TYPE type,SECItem *params);
    this.nss.PK11_GetBlockSize = nsslib.declare("PK11_GetBlockSize",
                                                ctypes.default_abi, ctypes.int,
                                                this.nss_t.CK_MECHANISM_TYPE, this.nss_t.SECItem.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#293
    // CK_MECHANISM_TYPE PK11_GetPadMechanism(CK_MECHANISM_TYPE);
    this.nss.PK11_GetPadMechanism = nsslib.declare("PK11_GetPadMechanism",
                                                   ctypes.default_abi, this.nss_t.CK_MECHANISM_TYPE,
                                                   this.nss_t.CK_MECHANISM_TYPE);
    // security/nss/lib/pk11wrap/pk11pub.h#271
    // SECItem *PK11_ParamFromIV(CK_MECHANISM_TYPE type,SECItem *iv);
    this.nss.PK11_ParamFromIV = nsslib.declare("PK11_ParamFromIV",
                                               ctypes.default_abi, this.nss_t.SECItem.ptr,
                                               this.nss_t.CK_MECHANISM_TYPE, this.nss_t.SECItem.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#301
    // PK11SymKey *PK11_ImportSymKey(PK11SlotInfo *slot, CK_MECHANISM_TYPE type, PK11Origin origin,
    //                               CK_ATTRIBUTE_TYPE operation, SECItem *key, void *wincx);
    this.nss.PK11_ImportSymKey = nsslib.declare("PK11_ImportSymKey",
                                                ctypes.default_abi, this.nss_t.PK11SymKey.ptr,
                                                this.nss_t.PK11SlotInfo.ptr, this.nss_t.CK_MECHANISM_TYPE, this.nss_t.PK11Origin,
                                                this.nss_t.CK_ATTRIBUTE_TYPE, this.nss_t.SECItem.ptr, ctypes.voidptr_t);
    // security/nss/lib/pk11wrap/pk11pub.h#672
    // PK11Context *PK11_CreateContextBySymKey(CK_MECHANISM_TYPE type, CK_ATTRIBUTE_TYPE operation,
    //                                         PK11SymKey *symKey, SECItem *param);
    this.nss.PK11_CreateContextBySymKey = nsslib.declare("PK11_CreateContextBySymKey",
                                                         ctypes.default_abi, this.nss_t.PK11Context.ptr,
                                                         this.nss_t.CK_MECHANISM_TYPE, this.nss_t.CK_ATTRIBUTE_TYPE,
                                                         this.nss_t.PK11SymKey.ptr, this.nss_t.SECItem.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#685
    // SECStatus PK11_CipherOp(PK11Context *context, unsigned char *out
    //                         int *outlen, int maxout, unsigned char *in, int inlen);
    this.nss.PK11_CipherOp = nsslib.declare("PK11_CipherOp",
                                            ctypes.default_abi, this.nss_t.SECStatus,
                                            this.nss_t.PK11Context.ptr, ctypes.unsigned_char.ptr,
                                            ctypes.int.ptr, ctypes.int, ctypes.unsigned_char.ptr, ctypes.int);
    // security/nss/lib/pk11wrap/pk11pub.h#688
    // SECStatus PK11_DigestFinal(PK11Context *context, unsigned char *data,
    //                            unsigned int *outLen, unsigned int length);
    this.nss.PK11_DigestFinal = nsslib.declare("PK11_DigestFinal",
                                               ctypes.default_abi, this.nss_t.SECStatus,
                                               this.nss_t.PK11Context.ptr, ctypes.unsigned_char.ptr,
                                               ctypes.unsigned_int.ptr, ctypes.unsigned_int);
    // security/nss/lib/pk11wrap/pk11pub.h#507
    // SECKEYPrivateKey *PK11_GenerateKeyPairWithFlags(PK11SlotInfo *slot,
    //                                                 CK_MECHANISM_TYPE type, void *param, SECKEYPublicKey **pubk,
    //                                                 PK11AttrFlags attrFlags, void *wincx);
    this.nss.PK11_GenerateKeyPairWithFlags = nsslib.declare("PK11_GenerateKeyPairWithFlags",
                                                            ctypes.default_abi, this.nss_t.SECKEYPrivateKey.ptr,
                                                            this.nss_t.PK11SlotInfo.ptr, this.nss_t.CK_MECHANISM_TYPE, ctypes.voidptr_t,
                                                            this.nss_t.SECKEYPublicKey.ptr.ptr, this.nss_t.PK11AttrFlags, ctypes.voidptr_t);
    // security/nss/lib/pk11wrap/pk11pub.h#466
    // SECStatus PK11_SetPrivateKeyNickname(SECKEYPrivateKey *privKey, const char *nickname);
    this.nss.PK11_SetPrivateKeyNickname = nsslib.declare("PK11_SetPrivateKeyNickname",
                                                         ctypes.default_abi, this.nss_t.SECStatus,
                                                         this.nss_t.SECKEYPrivateKey.ptr, ctypes.char.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#731
    // SECAlgorithmID * PK11_CreatePBEV2AlgorithmID(SECOidTag pbeAlgTag, SECOidTag cipherAlgTag,
    //                                              SECOidTag prfAlgTag, int keyLength, int iteration,
    //                                              SECItem *salt);
    this.nss.PK11_CreatePBEV2AlgorithmID = nsslib.declare("PK11_CreatePBEV2AlgorithmID",
                                                          ctypes.default_abi, this.nss_t.SECAlgorithmID.ptr,
                                                          this.nss_t.SECOidTag, this.nss_t.SECOidTag, this.nss_t.SECOidTag,
                                                          ctypes.int, ctypes.int, this.nss_t.SECItem.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#736
    // PK11SymKey * PK11_PBEKeyGen(PK11SlotInfo *slot, SECAlgorithmID *algid,  SECItem *pwitem, PRBool faulty3DES, void *wincx);
    this.nss.PK11_PBEKeyGen = nsslib.declare("PK11_PBEKeyGen",
                                             ctypes.default_abi, this.nss_t.PK11SymKey.ptr,
                                             this.nss_t.PK11SlotInfo.ptr, this.nss_t.SECAlgorithmID.ptr,
                                             this.nss_t.SECItem.ptr, this.nss_t.PRBool, ctypes.voidptr_t);
    // security/nss/lib/pk11wrap/pk11pub.h#574
    // SECStatus PK11_WrapPrivKey(PK11SlotInfo *slot, PK11SymKey *wrappingKey,
    //                            SECKEYPrivateKey *privKey, CK_MECHANISM_TYPE wrapType,
    //                            SECItem *param, SECItem *wrappedKey, void *wincx);
    this.nss.PK11_WrapPrivKey = nsslib.declare("PK11_WrapPrivKey",
                                               ctypes.default_abi, this.nss_t.SECStatus,
                                               this.nss_t.PK11SlotInfo.ptr, this.nss_t.PK11SymKey.ptr,
                                               this.nss_t.SECKEYPrivateKey.ptr, this.nss_t.CK_MECHANISM_TYPE,
                                               this.nss_t.SECItem.ptr, this.nss_t.SECItem.ptr, ctypes.voidptr_t);
    // security/nss/lib/cryptohi/keyhi.h#159
    // SECItem* SECKEY_EncodeDERSubjectPublicKeyInfo(SECKEYPublicKey *pubk);
    this.nss.SECKEY_EncodeDERSubjectPublicKeyInfo = nsslib.declare("SECKEY_EncodeDERSubjectPublicKeyInfo",
                                                                   ctypes.default_abi, this.nss_t.SECItem.ptr,
                                                                   this.nss_t.SECKEYPublicKey.ptr);
    // security/nss/lib/cryptohi/keyhi.h#165
    // CERTSubjectPublicKeyInfo * SECKEY_DecodeDERSubjectPublicKeyInfo(SECItem *spkider);
    this.nss.SECKEY_DecodeDERSubjectPublicKeyInfo = nsslib.declare("SECKEY_DecodeDERSubjectPublicKeyInfo",
                                                                   ctypes.default_abi, this.nss_t.CERTSubjectPublicKeyInfo.ptr,
                                                                   this.nss_t.SECItem.ptr);
    // security/nss/lib/cryptohi/keyhi.h#179
    // SECKEYPublicKey * SECKEY_ExtractPublicKey(CERTSubjectPublicKeyInfo *);
    this.nss.SECKEY_ExtractPublicKey = nsslib.declare("SECKEY_ExtractPublicKey",
                                                      ctypes.default_abi, this.nss_t.SECKEYPublicKey.ptr,
                                                      this.nss_t.CERTSubjectPublicKeyInfo.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#377
    // SECStatus PK11_PubWrapSymKey(CK_MECHANISM_TYPE type, SECKEYPublicKey *pubKey,
    //                              PK11SymKey *symKey, SECItem *wrappedKey);
    this.nss.PK11_PubWrapSymKey = nsslib.declare("PK11_PubWrapSymKey",
                                                 ctypes.default_abi, this.nss_t.SECStatus,
                                                 this.nss_t.CK_MECHANISM_TYPE, this.nss_t.SECKEYPublicKey.ptr,
                                                 this.nss_t.PK11SymKey.ptr, this.nss_t.SECItem.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#568
    // SECKEYPrivateKey *PK11_UnwrapPrivKey(PK11SlotInfo *slot,
    //                 PK11SymKey *wrappingKey, CK_MECHANISM_TYPE wrapType,
    //                 SECItem *param, SECItem *wrappedKey, SECItem *label,
    //                 SECItem *publicValue, PRBool token, PRBool sensitive,
    //                 CK_KEY_TYPE keyType, CK_ATTRIBUTE_TYPE *usage, int usageCount,
    //                 void *wincx);
    this.nss.PK11_UnwrapPrivKey = nsslib.declare("PK11_UnwrapPrivKey",
                                                 ctypes.default_abi, this.nss_t.SECKEYPrivateKey.ptr,
                                                 this.nss_t.PK11SlotInfo.ptr, this.nss_t.PK11SymKey.ptr,
                                                 this.nss_t.CK_MECHANISM_TYPE, this.nss_t.SECItem.ptr,
                                                 this.nss_t.SECItem.ptr, this.nss_t.SECItem.ptr,
                                                 this.nss_t.SECItem.ptr, this.nss_t.PRBool,
                                                 this.nss_t.PRBool, this.nss_t.CK_KEY_TYPE,
                                                 this.nss_t.CK_ATTRIBUTE_TYPE.ptr, ctypes.int,
                                                 ctypes.voidptr_t);
    // security/nss/lib/pk11wrap/pk11pub.h#447
    // PK11SymKey *PK11_PubUnwrapSymKey(SECKEYPrivateKey *key, SECItem *wrapppedKey,
    //         CK_MECHANISM_TYPE target, CK_ATTRIBUTE_TYPE operation, int keySize);
    this.nss.PK11_PubUnwrapSymKey = nsslib.declare("PK11_PubUnwrapSymKey",
                                                   ctypes.default_abi, this.nss_t.PK11SymKey.ptr,
                                                   this.nss_t.SECKEYPrivateKey.ptr, this.nss_t.SECItem.ptr,
                                                   this.nss_t.CK_MECHANISM_TYPE, this.nss_t.CK_ATTRIBUTE_TYPE, ctypes.int);
    // security/nss/lib/pk11wrap/pk11pub.h#675
    // void PK11_DestroyContext(PK11Context *context, PRBool freeit);
    this.nss.PK11_DestroyContext = nsslib.declare("PK11_DestroyContext",
                                                  ctypes.default_abi, ctypes.void_t,
                                                  this.nss_t.PK11Context.ptr, this.nss_t.PRBool);
    // security/nss/lib/pk11wrap/pk11pub.h#299
    // void PK11_FreeSymKey(PK11SymKey *key);
    this.nss.PK11_FreeSymKey = nsslib.declare("PK11_FreeSymKey",
                                              ctypes.default_abi, ctypes.void_t,
                                              this.nss_t.PK11SymKey.ptr);
    // security/nss/lib/pk11wrap/pk11pub.h#70
    // void PK11_FreeSlot(PK11SlotInfo *slot);
    this.nss.PK11_FreeSlot = nsslib.declare("PK11_FreeSlot",
                                            ctypes.default_abi, ctypes.void_t,
                                            this.nss_t.PK11SlotInfo.ptr);
    // security/nss/lib/util/secitem.h#114
    // extern void SECITEM_FreeItem(SECItem *zap, PRBool freeit);
    this.nss.SECITEM_FreeItem = nsslib.declare("SECITEM_FreeItem",
                                               ctypes.default_abi, ctypes.void_t,
                                               this.nss_t.SECItem.ptr, this.nss_t.PRBool);
    // security/nss/lib/cryptohi/keyhi.h#193
    // extern void SECKEY_DestroyPublicKey(SECKEYPublicKey *key);
    this.nss.SECKEY_DestroyPublicKey = nsslib.declare("SECKEY_DestroyPublicKey",
                                                      ctypes.default_abi, ctypes.void_t,
                                                      this.nss_t.SECKEYPublicKey.ptr);
    // security/nss/lib/cryptohi/keyhi.h#186
    // extern void SECKEY_DestroyPrivateKey(SECKEYPrivateKey *key);
    this.nss.SECKEY_DestroyPrivateKey = nsslib.declare("SECKEY_DestroyPrivateKey",
                                                       ctypes.default_abi, ctypes.void_t,
                                                       this.nss_t.SECKEYPrivateKey.ptr);
    // security/nss/lib/util/secoid.h#103
    // extern void SECOID_DestroyAlgorithmID(SECAlgorithmID *aid, PRBool freeit);
    this.nss.SECOID_DestroyAlgorithmID = nsslib.declare("SECOID_DestroyAlgorithmID",
                                                        ctypes.default_abi, ctypes.void_t,
                                                        this.nss_t.SECAlgorithmID.ptr, this.nss_t.PRBool);
    // security/nss/lib/cryptohi/keyhi.h#58
    // extern void SECKEY_DestroySubjectPublicKeyInfo(CERTSubjectPublicKeyInfo *spki);
    this.nss.SECKEY_DestroySubjectPublicKeyInfo = nsslib.declare("SECKEY_DestroySubjectPublicKeyInfo",
                                                                 ctypes.default_abi, ctypes.void_t,
                                                                 this.nss_t.CERTSubjectPublicKeyInfo.ptr);
  },


  algorithm : AES_256_CBC,

  keypairBits : 2048,

  encrypt : function(clearTextUCS2, symmetricKey, iv) {
    this.log("encrypt() called");

    // js-ctypes autoconverts to a UTF8 buffer, but also includes a null
    // at the end which we don't want. Cast to make the length 1 byte shorter.
    let inputBuffer = new ctypes.ArrayType(ctypes.unsigned_char)(clearTextUCS2);
    inputBuffer = ctypes.cast(inputBuffer, ctypes.unsigned_char.array(inputBuffer.length - 1));

    // When using CBC padding, the output size is the input size rounded
    // up to the nearest block. If the input size is exactly on a block
    // boundary, the output is 1 extra block long.
    let mech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
    let blockSize = this.nss.PK11_GetBlockSize(mech, null);
    let outputBufferSize = inputBuffer.length + blockSize;
    let outputBuffer = new ctypes.ArrayType(ctypes.unsigned_char, outputBufferSize)();

    outputBuffer = this._commonCrypt(inputBuffer, outputBuffer, symmetricKey, iv, this.nss.CKA_ENCRYPT);

    return this.encodeBase64(outputBuffer.address(), outputBuffer.length);
  },


  decrypt : function(cipherText, symmetricKey, iv) {
    this.log("decrypt() called");

    let inputUCS2 = "";
    if (cipherText.length)
      inputUCS2 = atob(cipherText);

    // We can't have js-ctypes create the buffer directly from the string
    // (as in encrypt()), because we do _not_ want it to do UTF8
    // conversion... We've got random binary data in the input's low byte.
    let input = new ctypes.ArrayType(ctypes.unsigned_char, inputUCS2.length)();
    this.byteCompress(inputUCS2, input);

    let outputBuffer = new ctypes.ArrayType(ctypes.unsigned_char, input.length)();

    outputBuffer = this._commonCrypt(input, outputBuffer, symmetricKey, iv, this.nss.CKA_DECRYPT);
    this.log("outputBuffer: " + outputBuffer);
    // outputBuffer contains UTF-8 data, let js-ctypes autoconvert that to a JS string.
    // XXX Bug 573842: wrap the string from ctypes to get a new string, so
    // we don't hit bug 573841.
    // XXXddahl: this may not be needed any longer as bug 573841 is fixed
    return "" + outputBuffer.readString() + "";
    // return outputBuffer.readString();
  },


  _commonCrypt : function (input, output, symmetricKey, iv, operation) {
    this.log("_commonCrypt() called");
    // Get rid of the base64 encoding and convert to SECItems.
    let keyItem = this.makeSECItem(symmetricKey, true);
    this.log("keyItem: " + keyItem);
    let ivItem  = this.makeSECItem(iv, true);
    this.log("ivItem: " + ivItem);
    // Determine which (padded) PKCS#11 mechanism to use.
    // EG: AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
    let mechanism = this.nss.PK11_AlgtagToMechanism(this.algorithm);
    mechanism = this.nss.PK11_GetPadMechanism(mechanism);
    if (mechanism == this.nss.CKM_INVALID_MECHANISM)
      throw new Error("invalid algorithm (can't pad)");

    let ctx, symKey, slot, ivParam;
    try {
      ivParam = this.nss.PK11_ParamFromIV(mechanism, ivItem.address());
      if (ivParam.isNull())
        throw new Error("can't convert IV to param");

      slot = this.nss.PK11_GetInternalKeySlot();
      if (slot.isNull())
        throw new Error("can't get internal key slot");

      symKey = this.nss.PK11_ImportSymKey(slot, mechanism, this.nss.PK11_OriginUnwrap, operation, keyItem.address(), null);
      if (symKey.isNull())
        throw new Error("symkey import failed");

      ctx = this.nss.PK11_CreateContextBySymKey(mechanism, operation, symKey, ivParam);
      if (ctx.isNull())
        throw new Error("couldn't create context for symkey");

      let maxOutputSize = output.length;
      let tmpOutputSize = new ctypes.int(); // Note 1: NSS uses a signed int here...

      if (this.nss.PK11_CipherOp(ctx, output, tmpOutputSize.address(), maxOutputSize, input, input.length))
        throw new Error("cipher operation failed");

      let actualOutputSize = tmpOutputSize.value;
      let finalOutput = output.addressOfElement(actualOutputSize);
      maxOutputSize -= actualOutputSize;

      // PK11_DigestFinal sure sounds like the last step for *hashing*, but it
      // just seems to be an odd name -- NSS uses this to finish the current
      // cipher operation. You'd think it would be called PK11_CipherOpFinal...
      let tmpOutputSize2 = new ctypes.unsigned_int(); // Note 2: ...but an unsigned here!
      if (this.nss.PK11_DigestFinal(ctx, finalOutput, tmpOutputSize2.address(), maxOutputSize))
        throw new Error("cipher finalize failed");

      actualOutputSize += tmpOutputSize2.value;
      let newOutput = ctypes.cast(output, ctypes.unsigned_char.array(actualOutputSize));
      this.log(newOutput);
      return newOutput;
    } catch (e) {
      this.log("_commonCrypt: failed: " + e);
      throw e;
    } finally {
      if (ctx && !ctx.isNull())
        this.nss.PK11_DestroyContext(ctx, true);
      if (symKey && !symKey.isNull())
        this.nss.PK11_FreeSymKey(symKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
      if (ivParam && !ivParam.isNull())
        this.nss.SECITEM_FreeItem(ivParam, true);
    }
  },

  sign : function _sign(encodedPrivateKey, iv, salt, passphrase, hash) {
    this.log("sign() called");

    let privKey, ivParam, wrappedPrivKey, ivItem,
    privKeyUsage, wrapMech, keyID, pbeKey, slot, _hash, sig;

    wrappedPrivKey = this.makeSECItem(encodedPrivateKey, true);

    _hash = this.makeSECItem(hash, false);

    sig = this.makeSECItem("", false);

    ivItem  = this.makeSECItem(iv, true);

    keyID = ivItem.address();

    let privKeyUsageLength = 1;
    privKeyUsage =
      new ctypes.ArrayType(this.nss_t.CK_ATTRIBUTE_TYPE, privKeyUsageLength)();
    privKeyUsage[0] = this.nss.CKA_UNWRAP;

    pbeKey = this._deriveKeyFromPassphrase(passphrase, salt);

    // AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
    wrapMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
    wrapMech = this.nss.PK11_GetPadMechanism(wrapMech);

    if (wrapMech == this.nss.CKM_INVALID_MECHANISM)
      throw new Error("unwrapSymKey: unknown key mech");

    ivParam = this.nss.PK11_ParamFromIV(wrapMech, ivItem.address());
    if (ivParam.isNull())
      throw new Error("unwrapSymKey: PK11_ParamFromIV failed");

    slot = this.nss.PK11_GetInternalSlot();
    if (slot.isNull())
      throw new Error("couldn't get internal slot");
    privKey = this.nss.PK11_UnwrapPrivKey(slot,
                                          pbeKey,
                                          wrapMech,
                                          ivParam,
                                          wrappedPrivKey.address(),
                                          null,   // label
                                          keyID,
                                          false, // isPerm (token object)
                                          true,  // isSensitive
                                          this.nss.CKK_RSA,
                                          privKeyUsage.addressOfElement(0),
                                          privKeyUsageLength,
                                          null);  // wincx
    if (privKey.isNull()) {
      throw new Error("sign error: Could not unwrap private key: incorrect passphrase entered");
    }
    let sigLen = this.nss.PK11_SignatureLen(privKey);
    sig.len = sigLen;
    sig.data = new ctypes.ArrayType(ctypes.unsigned_char, sigLen)();

    let status = this.nss.PK11_Sign(privKey, sig.address(), _hash.address());
    if (status == -1)
      throw new Error("Could not sign message");
    return this.encodeBase64(sig.data, sig.len);
  },

  verify : function _verify(encodedPublicKey, signature, hash) {
    this.log("verify() called");
    let pubKeyData = this.makeSECItem(encodedPublicKey, true);
    let pubKey;
    let pubKeyInfo = this.nss.SECKEY_DecodeDERSubjectPublicKeyInfo(pubKeyData.address());
    if (pubKeyInfo.isNull())
      throw new Error("SECKEY_DecodeDERSubjectPublicKeyInfo failed");

    pubKey = this.nss.SECKEY_ExtractPublicKey(pubKeyInfo);
    if (pubKey.isNull())
      throw new Error("SECKEY_ExtractPublicKey failed");

    let sig = this.makeSECItem(signature, true);

    let _hash = this.makeSECItem(hash, false);

    let status =
      this.nss.PK11_Verify(pubKey, sig.address(), _hash.address(), null);
    if (status == -1) {
      return false;
    }
    return true;
  },

  generateKeypair : function(passphrase, salt, iv, out_encodedPublicKey, out_wrappedPrivateKey) {
    this.log("generateKeypair() called.");

    let pubKey, privKey, slot;
    try {
      // Attributes for the private key. We're just going to wrap and extract the
      // value, so they're not critical. The _PUBLIC attribute just indicates the
      // object can be accessed without being logged into the token.
      let attrFlags = (this.nss.PK11_ATTR_SESSION | this.nss.PK11_ATTR_PUBLIC | this.nss.PK11_ATTR_SENSITIVE);

      pubKey  = new this.nss_t.SECKEYPublicKey.ptr();

      let rsaParams = new this.nss_t.PK11RSAGenParams();
      rsaParams.keySizeInBits = this.keypairBits; // 1024, 2048, etc.
      rsaParams.pe = 65537;                       // public exponent.

      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      // Generate the keypair.
      privKey = this.nss.PK11_GenerateKeyPairWithFlags(slot,
                                                       this.nss.CKM_RSA_PKCS_KEY_PAIR_GEN,
                                                       rsaParams.address(),
                                                       pubKey.address(),
                                                       attrFlags, null);
      if (privKey.isNull())
        throw new Error("keypair generation failed");

      let s = this.nss.PK11_SetPrivateKeyNickname(privKey, "Weave User PrivKey");
      if (s)
        throw new Error("key nickname failed");

      let wrappedPrivateKey = this._wrapPrivateKey(privKey, passphrase, salt, iv);
      out_wrappedPrivateKey.value = wrappedPrivateKey; // outparam

      let derKey = this.nss.SECKEY_EncodeDERSubjectPublicKeyInfo(pubKey);
      if (derKey.isNull())
        throw new Error("SECKEY_EncodeDERSubjectPublicKeyInfo failed");

      let encodedPublicKey = this.encodeBase64(derKey.contents.data, derKey.contents.len);
      out_encodedPublicKey.value = encodedPublicKey; // outparam
    } catch (e) {
      this.log("generateKeypair: failed: " + e);
      throw e;
    } finally {
      if (pubKey && !pubKey.isNull())
        this.nss.SECKEY_DestroyPublicKey(pubKey);
      if (privKey && !privKey.isNull())
        this.nss.SECKEY_DestroyPrivateKey(privKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
    }
  },


  generateRandomKey : function() {
    this.log("generateRandomKey() called");
    let encodedKey, keygenMech, keySize;

    // Doesn't NSS have a lookup function to do this?
    switch(this.algorithm) {
    case AES_128_CBC:
      keygenMech = this.nss.CKM_AES_KEY_GEN;
      keySize = 16;
      break;

    case AES_192_CBC:
      keygenMech = this.nss.CKM_AES_KEY_GEN;
      keySize = 24;
      break;

    case AES_256_CBC:
      keygenMech = this.nss.CKM_AES_KEY_GEN;
      keySize = 32;
      break;

    default:
      throw new Error("unknown algorithm");
    }

    let slot, randKey, keydata;
    try {
      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      randKey = this.nss.PK11_KeyGen(slot, keygenMech, null, keySize, null);
      if (randKey.isNull())
        throw new Error("PK11_KeyGen failed.");

      // Slightly odd API, this call just prepares the key value for
      // extraction, we get the actual bits from the call to PK11_GetKeyData().
      if (this.nss.PK11_ExtractKeyValue(randKey))
        throw new Error("PK11_ExtractKeyValue failed.");

      keydata = this.nss.PK11_GetKeyData(randKey);
      if (keydata.isNull())
        throw new Error("PK11_GetKeyData failed.");

      return this.encodeBase64(keydata.contents.data, keydata.contents.len);
    } catch (e) {
      this.log("generateRandomKey: failed: " + e);
      throw e;
    } finally {
      if (randKey && !randKey.isNull())
        this.nss.PK11_FreeSymKey(randKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
    }
  },


  generateRandomIV : function() {
    this.log("generateRandomIV() called");

    let mech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
    let size = this.nss.PK11_GetIVLength(mech);

    return this.generateRandomBytes(size);
  },


  generateRandomBytes : function(byteCount) {
    this.log("generateRandomBytes() called");

    // Temporary buffer to hold the generated data.
    let scratch = new ctypes.ArrayType(ctypes.unsigned_char, byteCount)();
    if (this.nss.PK11_GenerateRandom(scratch, byteCount))
      throw new Error("PK11_GenrateRandom failed");

    return this.encodeBase64(scratch.address(), scratch.length);
  },


  wrapSymmetricKey : function(symmetricKey, encodedPublicKey) {
    this.log("wrapSymmetricKey() called");

    // Step 1. Get rid of the base64 encoding on the inputs.

    let pubKeyData = this.makeSECItem(encodedPublicKey, true);
    let symKeyData = this.makeSECItem(symmetricKey, true);

    // This buffer is much larger than needed, but that's ok.
    let keyData = new ctypes.ArrayType(ctypes.unsigned_char, 4096)();
    let wrappedKey = new this.nss_t.SECItem(this.nss.SIBUFFER, keyData, keyData.length);

    // Step 2. Put the symmetric key bits into a P11 key object.
    let slot, symKey, pubKeyInfo, pubKey;
    try {
      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      // ImportSymKey wants a mechanism, from which it derives the key type.
      let keyMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);

      // This imports a key with the usage set for encryption, but that doesn't
      // really matter because we're just going to wrap it up and not use it.
      symKey = this.nss.PK11_ImportSymKey(slot, keyMech, this.nss.PK11_OriginUnwrap, this.nss.CKA_ENCRYPT, symKeyData.address(), null);
      if (symKey.isNull())
        throw new Error("symkey import failed");

      // Step 3. Put the public key bits into a P11 key object.

      // Can't just do this directly, it's expecting a minimal ASN1 blob
      // pubKey = SECKEY_ImportDERPublicKey(&pubKeyData, CKK_RSA);
      pubKeyInfo = this.nss.SECKEY_DecodeDERSubjectPublicKeyInfo(pubKeyData.address());
      if (pubKeyInfo.isNull())
        throw new Error("SECKEY_DecodeDERSubjectPublicKeyInfo failed");

      pubKey = this.nss.SECKEY_ExtractPublicKey(pubKeyInfo);
      if (pubKey.isNull())
        throw new Error("SECKEY_ExtractPublicKey failed");

      // Step 4. Wrap the symmetric key with the public key.

      let wrapMech = this.nss.PK11_AlgtagToMechanism(this.nss.SEC_OID_PKCS1_RSA_ENCRYPTION);

      let s = this.nss.PK11_PubWrapSymKey(wrapMech, pubKey, symKey, wrappedKey.address());
      if (s)
        throw new Error("PK11_PubWrapSymKey failed");

      // Step 5. Base64 encode the wrapped key, cleanup, and return to caller.
      return this.encodeBase64(wrappedKey.data, wrappedKey.len);
    } catch (e) {
      this.log("wrapSymmetricKey: failed: " + e);
      throw e;
    } finally {
      if (pubKey && !pubKey.isNull())
        this.nss.SECKEY_DestroyPublicKey(pubKey);
      if (pubKeyInfo && !pubKeyInfo.isNull())
        this.nss.SECKEY_DestroySubjectPublicKeyInfo(pubKeyInfo);
      if (symKey && !symKey.isNull())
        this.nss.PK11_FreeSymKey(symKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
    }
  },


  unwrapSymmetricKey : function(wrappedSymmetricKey, wrappedPrivateKey, passphrase, salt, iv) {
    this.log("unwrapSymmetricKey() called");
    let privKeyUsageLength = 1;
    let privKeyUsage = new ctypes.ArrayType(this.nss_t.CK_ATTRIBUTE_TYPE, privKeyUsageLength)();
    privKeyUsage[0] = this.nss.CKA_UNWRAP;

    // Step 1. Get rid of the base64 encoding on the inputs.
    let wrappedPrivKey = this.makeSECItem(wrappedPrivateKey, true);
    let wrappedSymKey  = this.makeSECItem(wrappedSymmetricKey, true);

    let ivParam, slot, pbeKey, symKey, privKey, symKeyData;
    try {
      // Step 2. Convert the passphrase to a symmetric key and get the IV in the proper form.
      pbeKey = this._deriveKeyFromPassphrase(passphrase, salt);
      let ivItem = this.makeSECItem(iv, true);

      // AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
      let wrapMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
      wrapMech = this.nss.PK11_GetPadMechanism(wrapMech);
      if (wrapMech == this.nss.CKM_INVALID_MECHANISM)
        throw new Error("unwrapSymKey: unknown key mech");

      ivParam = this.nss.PK11_ParamFromIV(wrapMech, ivItem.address());
      if (ivParam.isNull())
        throw new Error("unwrapSymKey: PK11_ParamFromIV failed");

      // Step 3. Unwrap the private key with the key from the passphrase.
      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      // Normally, one wants to associate a private key with a public key.
      // P11_UnwrapPrivKey() passes its keyID arg to PK11_MakeIDFromPubKey(),
      // which hashes the public key to create an ID (or, for small inputs,
      // assumes it's already hashed and does nothing).
      // We don't really care about this, because our unwrapped private key will
      // just live long enough to unwrap the bulk data key. So, we'll just jam in
      // a random value... We have an IV handy, so that will suffice.
      let keyID = ivItem.address();

      privKey = this.nss.PK11_UnwrapPrivKey(slot,
                                            pbeKey, wrapMech, ivParam, wrappedPrivKey.address(),
                                            null,   // label
                                            keyID,
                                            false, // isPerm (token object)
                                            true,  // isSensitive
                                            this.nss.CKK_RSA,
                                            privKeyUsage.addressOfElement(0), privKeyUsageLength,
                                            null);  // wincx
      if (privKey.isNull())
        throw new Error("PK11_UnwrapPrivKey failed");

      // Step 4. Unwrap the symmetric key with the user's private key.

      // XXX also have PK11_PubUnwrapSymKeyWithFlags() if more control is needed.
      // (last arg is keySize, 0 seems to work)
      symKey = this.nss.PK11_PubUnwrapSymKey(privKey, wrappedSymKey.address(), wrapMech,
                                             this.nss.CKA_DECRYPT, 0);
      if (symKey.isNull())
        throw new Error("PK11_PubUnwrapSymKey failed");

      // Step 5. Base64 encode the unwrapped key, cleanup, and return to caller.
      if (this.nss.PK11_ExtractKeyValue(symKey))
        throw new Error("PK11_ExtractKeyValue failed.");

      symKeyData = this.nss.PK11_GetKeyData(symKey);
      if (symKeyData.isNull())
        throw new Error("PK11_GetKeyData failed.");

      return this.encodeBase64(symKeyData.contents.data, symKeyData.contents.len);
    } catch (e) {
      this.log("unwrapSymmetricKey: failed: " + e);
      throw e;
    } finally {
      if (privKey && !privKey.isNull())
        this.nss.SECKEY_DestroyPrivateKey(privKey);
      if (symKey && !symKey.isNull())
        this.nss.PK11_FreeSymKey(symKey);
      if (pbeKey && !pbeKey.isNull())
        this.nss.PK11_FreeSymKey(pbeKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
      if (ivParam && !ivParam.isNull())
        this.nss.SECITEM_FreeItem(ivParam, true);
    }
  },


  rewrapPrivateKey : function(wrappedPrivateKey, oldPassphrase, salt, iv, newPassphrase) {
    this.log("rewrapPrivateKey() called");
    let privKeyUsageLength = 1;
    let privKeyUsage = new ctypes.ArrayType(this.nss_t.CK_ATTRIBUTE_TYPE, privKeyUsageLength)();
    privKeyUsage[0] = this.nss.CKA_UNWRAP;

    // Step 1. Get rid of the base64 encoding on the inputs.
    let wrappedPrivKey = this.makeSECItem(wrappedPrivateKey, true);

    let pbeKey, ivParam, slot, privKey;
    try {
      // Step 2. Convert the passphrase to a symmetric key and get the IV in the proper form.
      let pbeKey = this._deriveKeyFromPassphrase(oldPassphrase, salt);
      let ivItem = this.makeSECItem(iv, true);

      // AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
      let wrapMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
      wrapMech = this.nss.PK11_GetPadMechanism(wrapMech);
      if (wrapMech == this.nss.CKM_INVALID_MECHANISM)
        throw new Error("rewrapSymKey: unknown key mech");

      ivParam = this.nss.PK11_ParamFromIV(wrapMech, ivItem.address());
      if (ivParam.isNull())
        throw new Error("rewrapSymKey: PK11_ParamFromIV failed");

      // Step 3. Unwrap the private key with the key from the passphrase.
      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      let keyID = ivItem.address();

      privKey = this.nss.PK11_UnwrapPrivKey(slot,
                                            pbeKey, wrapMech, ivParam, wrappedPrivKey.address(),
                                            null,   // label
                                            keyID,
                                            false, // isPerm (token object)
                                            true,  // isSensitive
                                            this.nss.CKK_RSA,
                                            privKeyUsage.addressOfElement(0), privKeyUsageLength,
                                            null);  // wincx
      if (privKey.isNull())
        throw new Error("PK11_UnwrapPrivKey failed");

      // Step 4. Rewrap the private key with the new passphrase.
      return this._wrapPrivateKey(privKey, newPassphrase, salt, iv);
    } catch (e) {
      this.log("rewrapPrivateKey: failed: " + e);
      throw e;
    } finally {
      if (privKey && !privKey.isNull())
        this.nss.SECKEY_DestroyPrivateKey(privKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
      if (ivParam && !ivParam.isNull())
        this.nss.SECITEM_FreeItem(ivParam, true);
      if (pbeKey && !pbeKey.isNull())
        this.nss.PK11_FreeSymKey(pbeKey);
    }
  },


  verifyPassphrase : function(wrappedPrivateKey, passphrase, salt, iv) {
    this.log("verifyPassphrase() called");
    let privKeyUsageLength = 1;
    let privKeyUsage = new ctypes.ArrayType(this.nss_t.CK_ATTRIBUTE_TYPE, privKeyUsageLength)();
    privKeyUsage[0] = this.nss.CKA_UNWRAP;

    // Step 1. Get rid of the base64 encoding on the inputs.
    let wrappedPrivKey = this.makeSECItem(wrappedPrivateKey, true);

    let pbeKey, ivParam, slot, privKey;
    try {
      // Step 2. Convert the passphrase to a symmetric key and get the IV in the proper form.
      pbeKey = this._deriveKeyFromPassphrase(passphrase, salt);
      let ivItem = this.makeSECItem(iv, true);

      // AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
      let wrapMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
      wrapMech = this.nss.PK11_GetPadMechanism(wrapMech);
      if (wrapMech == this.nss.CKM_INVALID_MECHANISM)
        throw new Error("rewrapSymKey: unknown key mech");

      ivParam = this.nss.PK11_ParamFromIV(wrapMech, ivItem.address());
      if (ivParam.isNull())
        throw new Error("rewrapSymKey: PK11_ParamFromIV failed");

      // Step 3. Unwrap the private key with the key from the passphrase.
      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      let keyID = ivItem.address();

      privKey = this.nss.PK11_UnwrapPrivKey(slot,
                                            pbeKey, wrapMech, ivParam, wrappedPrivKey.address(),
                                            null,   // label
                                            keyID,
                                            false, // isPerm (token object)
                                            true,  // isSensitive
                                            this.nss.CKK_RSA,
                                            privKeyUsage.addressOfElement(0), privKeyUsageLength,
                                            null);  // wincx
      return (!privKey.isNull());
    } catch (e) {
      this.log("verifyPassphrase: failed: " + e);
      throw e;
    } finally {
      if (privKey && !privKey.isNull())
        this.nss.SECKEY_DestroyPrivateKey(privKey);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
      if (ivParam && !ivParam.isNull())
        this.nss.SECITEM_FreeItem(ivParam, true);
      if (pbeKey && !pbeKey.isNull())
        this.nss.PK11_FreeSymKey(pbeKey);
    }
  },


  //
  // Utility functions
  //


  // Compress a JS string (2-byte chars) into a normal C string (1-byte chars)
  // EG, for "ABC",  0x0041, 0x0042, 0x0043 --> 0x41, 0x42, 0x43
  byteCompress : function (jsString, charArray) {
    let intArray = ctypes.cast(charArray, ctypes.uint8_t.array(charArray.length));
    for (let i = 0; i < jsString.length; i++) {
      intArray[i] = jsString.charCodeAt(i) % 256; // convert to bytes
    }

  },

  // Expand a normal C string (1-byte chars) into a JS string (2-byte chars)
  // EG, for "ABC",  0x41, 0x42, 0x43 --> 0x0041, 0x0042, 0x0043
  byteExpand : function (charArray) {
    let expanded = "";
    let len = charArray.length;
    let intData = ctypes.cast(charArray, ctypes.uint8_t.array(len));
    for (let i = 0; i < len; i++)
      expanded += String.fromCharCode(intData[i]);

    return expanded;
  },

  encodeBase64 : function (data, len) {
    // Byte-expand the buffer, so we can treat it as a UCS-2 string
    // consisting of u0000 - u00FF.
    let expanded = "";
    let intData = ctypes.cast(data, ctypes.uint8_t.array(len).ptr).contents;
    for (let i = 0; i < len; i++)
      expanded += String.fromCharCode(intData[i]);

    return btoa(expanded);
  },


  makeSECItem : function(input, isEncoded) {
    if (isEncoded)
      input = atob(input);

    let outputData = new ctypes.ArrayType(ctypes.unsigned_char, input.length)();
    this.byteCompress(input, outputData);

    return new this.nss_t.SECItem(this.nss.SIBUFFER, outputData, outputData.length);
  },

  _deriveKeyFromPassphrase : function (passphrase, salt) {
    this.log("_deriveKeyFromPassphrase() called.");
    let passItem = this.makeSECItem(passphrase, false);
    let saltItem = this.makeSECItem(salt, true);

    // http://mxr.mozilla.org/seamonkey/source/security/nss/lib/pk11wrap/pk11pbe.c#1261

    // Bug 436577 prevents us from just using SEC_OID_PKCS5_PBKDF2 here
    let pbeAlg = this.algorithm;
    let cipherAlg = this.algorithm; // ignored by callee when pbeAlg != a pkcs5 mech.
    let prfAlg = this.nss.SEC_OID_HMAC_SHA1; // callee picks if SEC_OID_UNKNOWN, but only SHA1 is supported

    let keyLength  = 0;    // Callee will pick.
    let iterations = 4096; // PKCS#5 recommends at least 1000.

    let algid, slot, symKey;
    try {
      algid = this.nss.PK11_CreatePBEV2AlgorithmID(pbeAlg, cipherAlg, prfAlg,
                                                   keyLength, iterations, saltItem.address());
      if (algid.isNull())
        throw new Error("PK11_CreatePBEV2AlgorithmID failed");

      slot = this.nss.PK11_GetInternalSlot();
      if (slot.isNull())
        throw new Error("couldn't get internal slot");

      symKey = this.nss.PK11_PBEKeyGen(slot, algid, passItem.address(), false, null);
      if (symKey.isNull())
        throw new Error("PK11_PBEKeyGen failed");
    } catch (e) {
      this.log("_deriveKeyFromPassphrase: failed: " + e);
      throw e;
    } finally {
      if (algid && !algid.isNull())
        this.nss.SECOID_DestroyAlgorithmID(algid, true);
      if (slot && !slot.isNull())
        this.nss.PK11_FreeSlot(slot);
    }

    return symKey;
  },


  _wrapPrivateKey : function(privKey, passphrase, salt, iv) {
    this.log("_wrapPrivateKey() called.");
    let ivParam, pbeKey, wrappedKey;
    try {
      // Convert our passphrase to a symkey and get the IV in the form we want.
      pbeKey = this._deriveKeyFromPassphrase(passphrase, salt);

      let ivItem = this.makeSECItem(iv, true);

      // AES_128_CBC --> CKM_AES_CBC --> CKM_AES_CBC_PAD
      let wrapMech = this.nss.PK11_AlgtagToMechanism(this.algorithm);
      wrapMech = this.nss.PK11_GetPadMechanism(wrapMech);
      if (wrapMech == this.nss.CKM_INVALID_MECHANISM)
        throw new Error("wrapPrivKey: unknown key mech");

      let ivParam = this.nss.PK11_ParamFromIV(wrapMech, ivItem.address());
      if (ivParam.isNull())
        throw new Error("wrapPrivKey: PK11_ParamFromIV failed");

      // Use a buffer to hold the wrapped key. NSS says about 1200 bytes for
      // a 2048-bit RSA key, so a 4096 byte buffer should be plenty.
      let keyData = new ctypes.ArrayType(ctypes.unsigned_char, 4096)();
      wrappedKey = new this.nss_t.SECItem(this.nss.SIBUFFER, keyData, keyData.length);

      let s = this.nss.PK11_WrapPrivKey(privKey.contents.pkcs11Slot,
                                        pbeKey, privKey,
                                        wrapMech, ivParam,
                                        wrappedKey.address(), null);
      if (s)
        throw new Error("wrapPrivKey: PK11_WrapPrivKey failed");

      return this.encodeBase64(wrappedKey.data, wrappedKey.len);
    } catch (e) {
      this.log("_wrapPrivateKey: failed: " + e);
      throw e;
    } finally {
      if (ivParam && !ivParam.isNull())
        this.nss.SECITEM_FreeItem(ivParam, true);
      if (pbeKey && !pbeKey.isNull())
        this.nss.PK11_FreeSymKey(pbeKey);
    }
  }
};
