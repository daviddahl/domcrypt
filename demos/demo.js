// DOMCrypt demo script
// This demo does not implement any kind of persistent storage, as 
// references made to window.crypt.pubKey etc are fleeting and should, in practice, 
// be kept in a database of some kind.

window.addEventListener("load", function (){
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
  window.crypt.generateKeyPair();
  window.setTimeout(function(){ 
    document.getElementById("pubKey").innerHTML = window.crypt.getPubKey();
    }
    , 2000);
}

function encrypt()
{
  var msg = document.getElementById("plaintext").value;
  
  document.currentMessage = window.crypt.encrypt(msg);
  document.getElementById("encrypted").innerHTML = document.currentMessage.content;
}

function decrypt()
{
  var decrypted = 
    window.crypt.promptDecrypt(document.currentMessage);
  document.getElementById("decrypted").innerHTML = decrypted;
}
