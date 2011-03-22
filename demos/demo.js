// DOMCrypt demo script

window.addEventListener("load", function (){
  // if the user already has a key pair - fetch the public key to display on this page
  try {
    document.getElementById("pubKey").innerHTML = window.crypt.getPubKey();
  }
  catch (ex) {
    // noop
  }
}, false);

function getPubKey()
{
  document.getElementById("pubKey").innerHTML = window.crypt.getPubKey();
}

function generate()
{
  // begins the key pair generation routine, user is prompted by chrome-privileged passphrase prompt
  window.crypt.generateKeyPair();
  window.setTimeout(function(){
    document.getElementById("pubKey").innerHTML = window.crypt.getPubKey();
    }
    , 2000);
}

function encrypt()
{
  // encrypts the message with the current user's public key - this demo is quite simplistic in that there is only one user
  var msg = document.getElementById("plaintext").value;

  document.currentMessage = window.crypt.encrypt(msg);
  document.getElementById("encrypted").innerHTML = document.currentMessage.content;
}

function decrypt()
{
  // decrypt -  user is prompted by chrome-privileged prompt to collect the passphrase, which is garbage collected right away
  var decrypted =
    window.crypt.promptDecrypt(document.currentMessage);
  document.getElementById("decrypted").innerHTML = decrypted;
}

function signMessage()
{
  var msg = document.getElementById("message").textContent;
  var sig = window.crypt.sign(msg);
  document.getElementById("results").textContent = sig;
}

function verifySignature()
{
  var msgTxt = document.getElementById("message").innerHTML;
  var msgHash = window.crypt.makeHash(msgTxt);
  var sig = document.getElementById("results").innerHTML;
  if (sig) {
    var key = window.crypt.getPubKey();
    var results = window.crypt.verify(sig, msgHash, key);
    if (results) {
      document.getElementById("results-verify").innerHTML = results;
      alert("The message signature has been verified as authentic");
    }
    else {
      alert("ERROR: The message signature has NOT been verified as authentic");
    }
  }
  else {
    document.getElementById("results-verify").innerHTML = "You must sign the message first";
  }
}
