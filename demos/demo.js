// DOMCrypt demo script

window.addEventListener("load", function (){
  // if the user already has a key pair - fetch the public key to display on this page
  try {
    document.getElementById("pubKey").innerHTML = window.mozCipher.pk.getPublicKey();
  }
  catch (ex) {
    // noop
  }
}, false);

function getPubKey()
{
  window.mozCipher.pk.getPublicKey(function (aPubKey){
    document.getElementById("pubKey").innerHTML = aPubKey;
  });
}

function generate()
{
  // begins the key pair generation routine, user is prompted by chrome-privileged passphrase prompt
  window.mozCipher.pk.generateKeypair(function(aPubKey){
    document.getElementById("pubKey").innerHTML = aPubKey;
  });
}

function encrypt()
{
  // encrypts the message with the current user's public key - this demo is quite simplistic in that there is only one user
  var msg = document.getElementById("plaintext").value;
  var pubKey = document.getElementById("pubKey").innerHTML;
  window.mozCipher.pk.encrypt(msg, pubKey,
    function (aCipherMessage) {
      document.currentMessage = aCipherMessage;
      document.getElementById("encrypted").innerHTML = aCipherMessage.content;
    });
}

function decrypt()
{
  window.mozCipher.pk.decrypt(document.currentMessage, function (aPlainText){
    document.getElementById("decrypted").innerHTML = aPlainText;
  });
}

function signMessage()
{
  var msg = document.getElementById("message").textContent;
  window.mozCipher.pk.sign(msg, function (aSig){
    document.getElementById("results").textContent = aSig;
  });
}

function verifySignature()
{
  var msgTxt = document.getElementById("message").innerHTML;
  var sig = document.getElementById("results").innerHTML;
  if (sig) {
    console.log(sig);
    window.mozCipher.pk.getPublicKey(function callback (aPubKey){
      if (!aPubKey) {
        throw new Error("Verify Signature: Could not get the publicKey");
      }
      console.log(aPubKey);
      window.mozCipher.pk.verify(msgTxt, sig, aPubKey, function verifyCallback(aVer){
        console.log(aVer);
        if (aVer) {
          document.getElementById("results-verify").innerHTML = aVer.toString();
          alert("The message signature has been verified as authentic");
        }
        else {
          alert("ERROR: The message signature has NOT been verified as authentic");
        }
      });
    });
  }
  else {
    document.getElementById("results-verify").innerHTML = "You must sign the message first";
  }
}
