#! /bin/bash

mv built/domcrypt.xpi /tmp
cd domcrypt/
zip -r domcrypt.xpi * 
mv domcrypt.xpi ../built

echo "the domcrypt .xpi was built"
