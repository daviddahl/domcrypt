// DOMCrypt demo script
// This demo does not implement any kind of persistent storage, as 
// references made to window.crypt.pubKey etc are fleeting and should, in practice, 
// be kept in a database of some kind.

function generate()
{
  var passphrase = document.getElementById("passphrase").value;
  window.crypt.generateKeyPair(passphrase);
  window.setTimeout(function(){ 
    document.getElementById("pubKey").innerHTML = window.crypt.pubKey;
    document.getElementById("privKey").innerHTML = window.crypt.privKey;
    }
    , 2000);
}

function encrypt()
{
  var msg = document.getElementById("plaintext").value;
  
  document.currentMessage = window.crypt.encrypt(msg, window.crypt.pubKey);
  document.getElementById("encrypted").innerHTML = document.currentMessage.content;
}

function decrypt()
{
  var cryptoObj = {
    privKey: window.crypt.privKey,
    passphrase: document.getElementById("passphrase").value,
    aSalt: window.crypt.salt,
    aIV: window.crypt.iv
  };
  var decrypted = 
    window.crypt.decrypt(document.currentMessage, window.crypt.pubKey,cryptoObj);
  document.getElementById("decrypted").innerHTML = decrypted;
}
