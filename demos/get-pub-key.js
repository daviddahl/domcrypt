function getAddressbook()
{
  window.mozCipher.pk.getAddressbook(function (ab){
    var _ab = "";
    for (var idx in ab) {
      _ab += idx + " " + "\n";
      for (var _idx in ab[idx]) {
        _ab += _idx + ": " + ab[idx][_idx] + "\n";
      }
    }
    document.getElementById('addressbook-data').innerHTML = _ab.toString();
  });
}
