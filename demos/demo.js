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
