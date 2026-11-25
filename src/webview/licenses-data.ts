// AUTO-GENERATED FILE — do not edit by hand.
// Source: npm run licenses (scripts/generate-licenses.mts)

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repo: string;
  purpose: { en: string; ru: string };
  text: string;
}

export const LICENSE_ENTRIES: LicenseEntry[] = [
  {
    "name": "@breezystack/lamejs",
    "version": "1.2.7",
    "license": "LGPL-3.0",
    "repo": "https://github.com/shijinyu/lamejs",
    "purpose": {
      "en": "MP3 encoding in the audio editor (separate vendor script)",
      "ru": "Кодирование MP3 в аудиоредакторе (отдельный скрипт)"
    },
    "text": "Can I use LAME in my commercial program?  \n\nYes, you can, under the restrictions of the LGPL.  The easiest\nway to do this is to:\n\n1. Link to LAME as separate jar (lame.min.js or lame.all.js)\n\n2. Fully acknowledge that you are using LAME, and give a link\n   to our web site, lame.sourceforge.net\n\n3. If you make modifications to LAME, you *must* release these\n   these modifications back to the LAME project, under the LGPL.\n\n----------------------------------------------------------------------\nGNU Lesser General Public License v3.0\n----------------------------------------------------------------------\n\nGNU LESSER GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n\n Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>\n Everyone is permitted to copy and distribute verbatim copies\n of this license document, but changing it is not allowed.\n\n\n  This version of the GNU Lesser General Public License incorporates\nthe terms and conditions of version 3 of the GNU General Public\nLicense, supplemented by the additional permissions listed below.\n\n  0. Additional Definitions.\n\n  As used herein, \"this License\" refers to version 3 of the GNU Lesser\nGeneral Public License, and the \"GNU GPL\" refers to version 3 of the GNU\nGeneral Public License.\n\n  \"The Library\" refers to a covered work governed by this License,\nother than an Application or a Combined Work as defined below.\n\n  An \"Application\" is any work that makes use of an interface provided\nby the Library, but which is not otherwise based on the Library.\nDefining a subclass of a class defined by the Library is deemed a mode\nof using an interface provided by the Library.\n\n  A \"Combined Work\" is a work produced by combining or linking an\nApplication with the Library.  The particular version of the Library\nwith which the Combined Work was made is also called the \"Linked\nVersion\".\n\n  The \"Minimal Corresponding Source\" for a Combined Work means the\nCorresponding Source for the Combined Work, excluding any source code\nfor portions of the Combined Work that, considered in isolation, are\nbased on the Application, and not on the Linked Version.\n\n  The \"Corresponding Application Code\" for a Combined Work means the\nobject code and/or source code for the Application, including any data\nand utility programs needed for reproducing the Combined Work from the\nApplication, but excluding the System Libraries of the Combined Work.\n\n  1. Exception to Section 3 of the GNU GPL.\n\n  You may convey a covered work under sections 3 and 4 of this License\nwithout being bound by section 3 of the GNU GPL.\n\n  2. Conveying Modified Versions.\n\n  If you modify a copy of the Library, and, in your modifications, a\nfacility refers to a function or data to be supplied by an Application\nthat uses the facility (other than as an argument passed when the\nfacility is invoked), then you may convey a copy of the modified\nversion:\n\n   a) under this License, provided that you make a good faith effort to\n   ensure that, in the event an Application does not supply the\n   function or data, the facility still operates, and performs\n   whatever part of its purpose remains meaningful, or\n\n   b) under the GNU GPL, with none of the additional permissions of\n   this License applicable to that copy.\n\n  3. Object Code Incorporating Material from Library Header Files.\n\n  The object code form of an Application may incorporate material from\na header file that is part of the Library.  You may convey such object\ncode under terms of your choice, provided that, if the incorporated\nmaterial is not limited to numerical parameters, data structure\nlayouts and accessors, or small macros, inline functions and templates\n(ten or fewer lines in length), you do both of the following:\n\n   a) Give prominent notice with each copy of the object code that the\n   Library is used in it and that the Library and its use are\n   covered by this License.\n\n   b) Accompany the object code with a copy of the GNU GPL and this license\n   document.\n\n  4. Combined Works.\n\n  You may convey a Combined Work under terms of your choice that,\ntaken together, effectively do not restrict modification of the\nportions of the Library contained in the Combined Work and reverse\nengineering for debugging such modifications, if you also do each of\nthe following:\n\n   a) Give prominent notice with each copy of the Combined Work that\n   the Library is used in it and that the Library and its use are\n   covered by this License.\n\n   b) Accompany the Combined Work with a copy of the GNU GPL and this license\n   document.\n\n   c) For a Combined Work that displays copyright notices during\n   execution, include the copyright notice for the Library among\n   these notices, as well as a reference directing the user to the\n   copies of the GNU GPL and this license document.\n\n   d) Do one of the following:\n\n       0) Convey the Minimal Corresponding Source under the terms of this\n       License, and the Corresponding Application Code in a form\n       suitable for, and under terms that permit, the user to\n       recombine or relink the Application with a modified version of\n       the Linked Version to produce a modified Combined Work, in the\n       manner specified by section 6 of the GNU GPL for conveying\n       Corresponding Source.\n\n       1) Use a suitable shared library mechanism for linking with the\n       Library.  A suitable mechanism is one that (a) uses at run time\n       a copy of the Library already present on the user's computer\n       system, and (b) will operate properly with a modified version\n       of the Library that is interface-compatible with the Linked\n       Version.\n\n   e) Provide Installation Information, but only if you would otherwise\n   be required to provide such information under section 6 of the\n   GNU GPL, and only to the extent that such information is\n   necessary to install and execute a modified version of the\n   Combined Work produced by recombining or relinking the\n   Application with a modified version of the Linked Version. (If\n   you use option 4d0, the Installation Information must accompany\n   the Minimal Corresponding Source and Corresponding Application\n   Code. If you use option 4d1, you must provide the Installation\n   Information in the manner specified by section 6 of the GNU GPL\n   for conveying Corresponding Source.)\n\n  5. Combined Libraries.\n\n  You may place library facilities that are a work based on the\nLibrary side by side in a single library together with other library\nfacilities that are not Applications and are not covered by this\nLicense, and convey such a combined library under terms of your\nchoice, if you do both of the following:\n\n   a) Accompany the combined library with a copy of the same work based\n   on the Library, uncombined with any other library facilities,\n   conveyed under the terms of this License.\n\n   b) Give prominent notice with the combined library that part of it\n   is a work based on the Library, and explaining where to find the\n   accompanying uncombined form of the same work.\n\n  6. Revised Versions of the GNU Lesser General Public License.\n\n  The Free Software Foundation may publish revised and/or new versions\nof the GNU Lesser General Public License from time to time. Such new\nversions will be similar in spirit to the present version, but may\ndiffer in detail to address new problems or concerns.\n\n  Each version is given a distinguishing version number. If the\nLibrary as you received it specifies that a certain numbered version\nof the GNU Lesser General Public License \"or any later version\"\napplies to it, you have the option of following the terms and\nconditions either of that published version or of any later version\npublished by the Free Software Foundation. If the Library as you\nreceived it does not specify a version number of the GNU Lesser\nGeneral Public License, you may choose any version of the GNU Lesser\nGeneral Public License ever published by the Free Software Foundation.\n\n  If the Library as you received it specifies that a proxy can decide\nwhether future versions of the GNU Lesser General Public License shall\napply, that proxy's public statement of acceptance of any version is\npermanent authorization for you to choose that version for the\nLibrary."
  },
  {
    "name": "@jsep-plugin/assignment",
    "version": "1.4.0",
    "license": "MIT",
    "repo": "https://github.com/EricSmekens/jsep",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Copyright (c) 2013 Stephen Oney, https://ericsmekens.github.io/jsep/\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
  },
  {
    "name": "@jsep-plugin/regex",
    "version": "1.1.0",
    "license": "MIT",
    "repo": "https://github.com/EricSmekens/jsep",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Copyright (c) 2013 Stephen Oney, https://ericsmekens.github.io/jsep/\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
  },
  {
    "name": "@li0ard/gost",
    "version": "0.3.3",
    "license": "MIT",
    "repo": "https://github.com/li0ard/gost",
    "purpose": {
      "en": "GOST R 34.12-2015, 34.11-2012 and 34.10-2012 algorithms",
      "ru": "Алгоритмы ГОСТ Р 34.12-2015, 34.11-2012 и 34.10-2012"
    },
    "text": "MIT License\n\nCopyright (c) 2026 Nikolai Konovalov\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
  },
  {
    "name": "@noble/ciphers",
    "version": "2.4.0",
    "license": "MIT",
    "repo": "https://github.com/paulmillr/noble-ciphers",
    "purpose": {
      "en": "AES and ChaCha ciphers",
      "ru": "Шифры AES и ChaCha"
    },
    "text": "The MIT License (MIT)\n\nCopyright (c) 2022 Paul Miller (https://paulmillr.com)\nCopyright (c) 2016 Thomas Pornin <pornin@bolet.org>\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the “Software”), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."
  },
  {
    "name": "@noble/curves",
    "version": "2.4.0",
    "license": "MIT",
    "repo": "https://github.com/paulmillr/noble-curves",
    "purpose": {
      "en": "secp256k1, X25519 and P-256 curves",
      "ru": "Кривые secp256k1, X25519 и P-256"
    },
    "text": "The MIT License (MIT)\n\nCopyright (c) 2022 Paul Miller (https://paulmillr.com)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the “Software”), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."
  },
  {
    "name": "@noble/hashes",
    "version": "2.4.0",
    "license": "MIT",
    "repo": "https://github.com/paulmillr/noble-hashes",
    "purpose": {
      "en": "scrypt, Argon2id and hash helpers",
      "ru": "scrypt, Argon2id и хеш-функции"
    },
    "text": "The MIT License (MIT)\n\nCopyright (c) 2022 Paul Miller (https://paulmillr.com)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the “Software”), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."
  },
  {
    "name": "@pdf-lib/standard-fonts",
    "version": "1.0.0",
    "license": "MIT",
    "repo": "https://github.com/Hopding/standard-fonts",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "MIT License\n\nCopyright (c) 2018 Andrew Dillon\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
  },
  {
    "name": "@pdf-lib/upng",
    "version": "1.0.1",
    "license": "MIT",
    "repo": "https://github.com/Hopding/upng",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "MIT License\n\nCopyright (c) 2017 Photopea\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
  },
  {
    "name": "argparse",
    "version": "3.0.4",
    "license": "PSF-2.0",
    "repo": "https://github.com/nodeca/argparse",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2\n\n1. This LICENSE AGREEMENT is between the Python Software Foundation\n(\"PSF\"), and the Individual or Organization (\"Licensee\") accessing and\notherwise using this software (\"Python\") in source or binary form and\nits associated documentation.\n\n2. Subject to the terms and conditions of this License Agreement, PSF hereby\ngrants Licensee a nonexclusive, royalty-free, world-wide license to reproduce,\nanalyze, test, perform and/or display publicly, prepare derivative works,\ndistribute, and otherwise use Python alone or in any derivative version,\nprovided, however, that PSF's License Agreement and PSF's notice of copyright,\ni.e., \"Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,\n2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019 Python Software Foundation;\nAll Rights Reserved\" are retained in Python alone or in any derivative version\nprepared by Licensee.\n\n3. In the event Licensee prepares a derivative work that is based on\nor incorporates Python or any part thereof, and wants to make\nthe derivative work available to others as provided herein, then\nLicensee hereby agrees to include in any such work a brief summary of\nthe changes made to Python.\n\n4. PSF is making Python available to Licensee on an \"AS IS\"\nbasis.  PSF MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR\nIMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, PSF MAKES NO AND\nDISCLAIMS ANY REPRESENTATION OR WARRANTY OF MERCHANTABILITY OR FITNESS\nFOR ANY PARTICULAR PURPOSE OR THAT THE USE OF PYTHON WILL NOT\nINFRINGE ANY THIRD PARTY RIGHTS.\n\n5. PSF SHALL NOT BE LIABLE TO LICENSEE OR ANY OTHER USERS OF PYTHON\nFOR ANY INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES OR LOSS AS\nA RESULT OF MODIFYING, DISTRIBUTING, OR OTHERWISE USING PYTHON,\nOR ANY DERIVATIVE THEREOF, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.\n\n6. This License Agreement will automatically terminate upon a material\nbreach of its terms and conditions.\n\n7. Nothing in this License Agreement shall be deemed to create any\nrelationship of agency, partnership, or joint venture between PSF and\nLicensee.  This License Agreement does not grant permission to use PSF\ntrademarks or trade name in a trademark sense to endorse or promote\nproducts or services of Licensee, or any third party.\n\n8. By copying, installing or otherwise using Python, Licensee\nagrees to be bound by the terms and conditions of this License\nAgreement."
  },
  {
    "name": "bcryptjs",
    "version": "3.0.3",
    "license": "BSD-3-Clause",
    "repo": "https://github.com/dcodeIO/bcrypt.js",
    "purpose": {
      "en": "bcrypt password hashing",
      "ru": "Хеширование паролей bcrypt"
    },
    "text": "bcrypt.js\n---------\nCopyright (c) 2012 Nevins Bartolomeo <nevins.bartolomeo@gmail.com>\nCopyright (c) 2012 Shane Girish <shaneGirish@gmail.com>\nCopyright (c) 2025 Daniel Wirtz <dcode@dcode.io>\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions\nare met:\n1. Redistributions of source code must retain the above copyright\n   notice, this list of conditions and the following disclaimer.\n2. Redistributions in binary form must reproduce the above copyright\n   notice, this list of conditions and the following disclaimer in the\n   documentation and/or other materials provided with the distribution.\n3. The name of the author may not be used to endorse or promote products\n   derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR\nIMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES\nOF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.\nIN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,\nINCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT\nNOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,\nDATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY\nTHEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF\nTHIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE."
  },
  {
    "name": "diff",
    "version": "9.0.0",
    "license": "BSD-3-Clause",
    "repo": "https://github.com/kpdecker/jsdiff",
    "purpose": {
      "en": "Text and list comparison",
      "ru": "Сравнение текста и списков"
    },
    "text": "BSD 3-Clause License\n\nCopyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are met:\n\n1. Redistributions of source code must retain the above copyright notice, this\n   list of conditions and the following disclaimer.\n\n2. Redistributions in binary form must reproduce the above copyright notice,\n   this list of conditions and the following disclaimer in the documentation\n   and/or other materials provided with the distribution.\n\n3. Neither the name of the copyright holder nor the names of its\n   contributors may be used to endorse or promote products derived from\n   this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\"\nAND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\nIMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\nDISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE\nFOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL\nDAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR\nSERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER\nCAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,\nOR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\nOF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE."
  },
  {
    "name": "js-yaml",
    "version": "5.5.0",
    "license": "MIT",
    "repo": "https://github.com/nodeca/js-yaml",
    "purpose": {
      "en": "YAML parsing and serialisation",
      "ru": "Разбор и сериализация YAML"
    },
    "text": "(The MIT License)\n\nCopyright (C) 2011-2015 by Vitaly Puzrin\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."
  },
  {
    "name": "jsbn",
    "version": "1.1.0",
    "license": "MIT",
    "repo": "https://github.com/andyperlitch/jsbn",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Licensing\n---------\n\nThis software is covered under the following copyright:\n\n/*\n * Copyright (c) 2003-2005  Tom Wu\n * All Rights Reserved.\n *\n * Permission is hereby granted, free of charge, to any person obtaining\n * a copy of this software and associated documentation files (the\n * \"Software\"), to deal in the Software without restriction, including\n * without limitation the rights to use, copy, modify, merge, publish,\n * distribute, sublicense, and/or sell copies of the Software, and to\n * permit persons to whom the Software is furnished to do so, subject to\n * the following conditions:\n *\n * The above copyright notice and this permission notice shall be\n * included in all copies or substantial portions of the Software.\n *\n * THE SOFTWARE IS PROVIDED \"AS-IS\" AND WITHOUT WARRANTY OF ANY KIND, \n * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY \n * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  \n *\n * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,\n * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER\n * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF\n * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT\n * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n *\n * In addition, the following condition applies:\n *\n * All redistributions must retain an intact copy of this copyright notice\n * and disclaimer.\n */\n\nAddress all questions regarding this license to:\n\n  Tom Wu\n  tjw@cs.Stanford.EDU"
  },
  {
    "name": "jsep",
    "version": "1.6.0",
    "license": "MIT",
    "repo": "https://github.com/EricSmekens/jsep",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Copyright (c) 2013 Stephen Oney, https://ericsmekens.github.io/jsep/\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
  },
  {
    "name": "jsonpath-plus",
    "version": "11.3.0",
    "license": "MIT",
    "repo": "git://github.com/s3u/JSONPath",
    "purpose": {
      "en": "JSONPath queries",
      "ru": "Запросы JSONPath"
    },
    "text": "MIT License\n\nCopyright (c) 2011-2019 Stefan Goessner, Subbu Allamaraju, Mike Brevoort,\nRobert Krahn, Brett Zamir, Richard Schneider\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
  },
  {
    "name": "marked",
    "version": "18.2.1",
    "license": "MIT",
    "repo": "https://github.com/markedjs/marked",
    "purpose": {
      "en": "Markdown preview",
      "ru": "Предпросмотр Markdown"
    },
    "text": "# License information\n\n## Contribution License Agreement\n\nIf you contribute code to this project, you are implicitly allowing your code\nto be distributed under the MIT license. You are also implicitly verifying that\nall code is your original work. `</legalese>`\n\n## Marked\n\nCopyright (c) 2018+, MarkedJS (https://github.com/markedjs/)\nCopyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n## Markdown\n\nCopyright © 2004, John Gruber\nhttp://daringfireball.net/\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n* Neither the name “Markdown” nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nThis software is provided by the copyright holders and contributors “as is” and any express or implied warranties, including, but not limited to, the implied warranties of merchantability and fitness for a particular purpose are disclaimed. In no event shall the copyright owner or contributors be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute goods or services; loss of use, data, or profits; or business interruption) however caused and on any theory of liability, whether in contract, strict liability, or tort (including negligence or otherwise) arising in any way out of the use of this software, even if advised of the possibility of such damage."
  },
  {
    "name": "pako",
    "version": "1.0.11",
    "license": "(MIT AND Zlib)",
    "repo": "https://github.com/nodeca/pako",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "(The MIT License)\n\nCopyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n----------------------------------------------------------------------\nzlib License (zlib-derived code inside the package)\n----------------------------------------------------------------------\n\nzlib License\n\nCopyright (C) 1995-2013 Jean-loup Gailly and Mark Adler\n\nThis software is provided 'as-is', without any express or implied\nwarranty.  In no event will the authors be held liable for any damages\narising from the use of this software.\n\nPermission is granted to anyone to use this software for any purpose,\nincluding commercial applications, and to alter it and redistribute it\nfreely, subject to the following restrictions:\n\n1. The origin of this software must not be misrepresented; you must not\n   claim that you wrote the original software. If you use this software\n   in a product, an acknowledgment in the product documentation would be\n   appreciated but is not required.\n2. Altered source versions must be plainly marked as such, and must not be\n   misrepresented as being the original software.\n3. This notice may not be removed or altered from any source distribution."
  },
  {
    "name": "pdf-lib",
    "version": "1.17.1",
    "license": "MIT",
    "repo": "https://github.com/Hopding/pdf-lib",
    "purpose": {
      "en": "PDF merge, split and page editing",
      "ru": "Объединение, разделение и правка страниц PDF"
    },
    "text": "MIT License\n\nCopyright (c) 2019 Andrew Dillon\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
  },
  {
    "name": "pdfjs-dist",
    "version": "5.4.624",
    "license": "Apache-2.0",
    "repo": "https://github.com/mozilla/pdf.js",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Apache License\n                           Version 2.0, January 2004\n                        http://www.apache.org/licenses/\n\n   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n   1. Definitions.\n\n      \"License\" shall mean the terms and conditions for use, reproduction,\n      and distribution as defined by Sections 1 through 9 of this document.\n\n      \"Licensor\" shall mean the copyright owner or entity authorized by\n      the copyright owner that is granting the License.\n\n      \"Legal Entity\" shall mean the union of the acting entity and all\n      other entities that control, are controlled by, or are under common\n      control with that entity. For the purposes of this definition,\n      \"control\" means (i) the power, direct or indirect, to cause the\n      direction or management of such entity, whether by contract or\n      otherwise, or (ii) ownership of fifty percent (50%) or more of the\n      outstanding shares, or (iii) beneficial ownership of such entity.\n\n      \"You\" (or \"Your\") shall mean an individual or Legal Entity\n      exercising permissions granted by this License.\n\n      \"Source\" form shall mean the preferred form for making modifications,\n      including but not limited to software source code, documentation\n      source, and configuration files.\n\n      \"Object\" form shall mean any form resulting from mechanical\n      transformation or translation of a Source form, including but\n      not limited to compiled object code, generated documentation,\n      and conversions to other media types.\n\n      \"Work\" shall mean the work of authorship, whether in Source or\n      Object form, made available under the License, as indicated by a\n      copyright notice that is included in or attached to the work\n      (an example is provided in the Appendix below).\n\n      \"Derivative Works\" shall mean any work, whether in Source or Object\n      form, that is based on (or derived from) the Work and for which the\n      editorial revisions, annotations, elaborations, or other modifications\n      represent, as a whole, an original work of authorship. For the purposes\n      of this License, Derivative Works shall not include works that remain\n      separable from, or merely link (or bind by name) to the interfaces of,\n      the Work and Derivative Works thereof.\n\n      \"Contribution\" shall mean any work of authorship, including\n      the original version of the Work and any modifications or additions\n      to that Work or Derivative Works thereof, that is intentionally\n      submitted to Licensor for inclusion in the Work by the copyright owner\n      or by an individual or Legal Entity authorized to submit on behalf of\n      the copyright owner. For the purposes of this definition, \"submitted\"\n      means any form of electronic, verbal, or written communication sent\n      to the Licensor or its representatives, including but not limited to\n      communication on electronic mailing lists, source code control systems,\n      and issue tracking systems that are managed by, or on behalf of, the\n      Licensor for the purpose of discussing and improving the Work, but\n      excluding communication that is conspicuously marked or otherwise\n      designated in writing by the copyright owner as \"Not a Contribution.\"\n\n      \"Contributor\" shall mean Licensor and any individual or Legal Entity\n      on behalf of whom a Contribution has been received by Licensor and\n      subsequently incorporated within the Work.\n\n   2. Grant of Copyright License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      copyright license to reproduce, prepare Derivative Works of,\n      publicly display, publicly perform, sublicense, and distribute the\n      Work and such Derivative Works in Source or Object form.\n\n   3. Grant of Patent License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      (except as stated in this section) patent license to make, have made,\n      use, offer to sell, sell, import, and otherwise transfer the Work,\n      where such license applies only to those patent claims licensable\n      by such Contributor that are necessarily infringed by their\n      Contribution(s) alone or by combination of their Contribution(s)\n      with the Work to which such Contribution(s) was submitted. If You\n      institute patent litigation against any entity (including a\n      cross-claim or counterclaim in a lawsuit) alleging that the Work\n      or a Contribution incorporated within the Work constitutes direct\n      or contributory patent infringement, then any patent licenses\n      granted to You under this License for that Work shall terminate\n      as of the date such litigation is filed.\n\n   4. Redistribution. You may reproduce and distribute copies of the\n      Work or Derivative Works thereof in any medium, with or without\n      modifications, and in Source or Object form, provided that You\n      meet the following conditions:\n\n      (a) You must give any other recipients of the Work or\n          Derivative Works a copy of this License; and\n\n      (b) You must cause any modified files to carry prominent notices\n          stating that You changed the files; and\n\n      (c) You must retain, in the Source form of any Derivative Works\n          that You distribute, all copyright, patent, trademark, and\n          attribution notices from the Source form of the Work,\n          excluding those notices that do not pertain to any part of\n          the Derivative Works; and\n\n      (d) If the Work includes a \"NOTICE\" text file as part of its\n          distribution, then any Derivative Works that You distribute must\n          include a readable copy of the attribution notices contained\n          within such NOTICE file, excluding those notices that do not\n          pertain to any part of the Derivative Works, in at least one\n          of the following places: within a NOTICE text file distributed\n          as part of the Derivative Works; within the Source form or\n          documentation, if provided along with the Derivative Works; or,\n          within a display generated by the Derivative Works, if and\n          wherever such third-party notices normally appear. The contents\n          of the NOTICE file are for informational purposes only and\n          do not modify the License. You may add Your own attribution\n          notices within Derivative Works that You distribute, alongside\n          or as an addendum to the NOTICE text from the Work, provided\n          that such additional attribution notices cannot be construed\n          as modifying the License.\n\n      You may add Your own copyright statement to Your modifications and\n      may provide additional or different license terms and conditions\n      for use, reproduction, or distribution of Your modifications, or\n      for any such Derivative Works as a whole, provided Your use,\n      reproduction, and distribution of the Work otherwise complies with\n      the conditions stated in this License.\n\n   5. Submission of Contributions. Unless You explicitly state otherwise,\n      any Contribution intentionally submitted for inclusion in the Work\n      by You to the Licensor shall be under the terms and conditions of\n      this License, without any additional terms or conditions.\n      Notwithstanding the above, nothing herein shall supersede or modify\n      the terms of any separate license agreement you may have executed\n      with Licensor regarding such Contributions.\n\n   6. Trademarks. This License does not grant permission to use the trade\n      names, trademarks, service marks, or product names of the Licensor,\n      except as required for reasonable and customary use in describing the\n      origin of the Work and reproducing the content of the NOTICE file.\n\n   7. Disclaimer of Warranty. Unless required by applicable law or\n      agreed to in writing, Licensor provides the Work (and each\n      Contributor provides its Contributions) on an \"AS IS\" BASIS,\n      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or\n      implied, including, without limitation, any warranties or conditions\n      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A\n      PARTICULAR PURPOSE. You are solely responsible for determining the\n      appropriateness of using or redistributing the Work and assume any\n      risks associated with Your exercise of permissions under this License.\n\n   8. Limitation of Liability. In no event and under no legal theory,\n      whether in tort (including negligence), contract, or otherwise,\n      unless required by applicable law (such as deliberate and grossly\n      negligent acts) or agreed to in writing, shall any Contributor be\n      liable to You for damages, including any direct, indirect, special,\n      incidental, or consequential damages of any character arising as a\n      result of this License or out of the use or inability to use the\n      Work (including but not limited to damages for loss of goodwill,\n      work stoppage, computer failure or malfunction, or any and all\n      other commercial damages or losses), even if such Contributor\n      has been advised of the possibility of such damages.\n\n   9. Accepting Warranty or Additional Liability. While redistributing\n      the Work or Derivative Works thereof, You may choose to offer,\n      and charge a fee for, acceptance of support, warranty, indemnity,\n      or other liability obligations and/or rights consistent with this\n      License. However, in accepting such obligations, You may act only\n      on Your own behalf and on Your sole responsibility, not on behalf\n      of any other Contributor, and only if You agree to indemnify,\n      defend, and hold each Contributor harmless for any liability\n      incurred by, or claims asserted against, such Contributor by reason\n      of your accepting any such warranty or additional liability.\n\n   END OF TERMS AND CONDITIONS"
  },
  {
    "name": "qrcode-generator",
    "version": "2.0.4",
    "license": "MIT",
    "repo": "https://github.com/kazuhikoarase/qrcode-generator",
    "purpose": {
      "en": "QR code generation",
      "ru": "Генерация QR-кодов"
    },
    "text": "MIT License\n\nCopyright (c) Kazuhiko Arase\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
  },
  {
    "name": "semver",
    "version": "7.8.6",
    "license": "ISC",
    "repo": "https://github.com/npm/node-semver",
    "purpose": {
      "en": "Semantic version checks",
      "ru": "Работа с семантическими версиями"
    },
    "text": "The ISC License\n\nCopyright (c) Isaac Z. Schlueter and Contributors\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above\ncopyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES\nWITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF\nMERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR\nANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES\nWHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN\nACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR\nIN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE."
  },
  {
    "name": "sm-crypto",
    "version": "0.5.9",
    "license": "MIT",
    "repo": "https://github.com/JuneAndGreen/sm-crypto",
    "purpose": {
      "en": "SM2, SM3 and SM4 algorithms",
      "ru": "Алгоритмы SM2, SM3 и SM4"
    },
    "text": "Copyright © 2018 june01\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
  },
  {
    "name": "three",
    "version": "0.187.0",
    "license": "MIT",
    "repo": "https://github.com/mrdoob/three.js",
    "purpose": {
      "en": "3D rendering (3D Scene and CAD editors)",
      "ru": "3D-рендеринг (3D-сцена и CAD-редактор)"
    },
    "text": "The MIT License\n\nCopyright © 2010-2026 three.js authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE."
  },
  {
    "name": "tslib",
    "version": "1.14.1",
    "license": "0BSD",
    "repo": "https://github.com/Microsoft/tslib",
    "purpose": {
      "en": "transitive dependency",
      "ru": "транзитивная зависимость"
    },
    "text": "Copyright (c) Microsoft Corporation.\r\n\r\nPermission to use, copy, modify, and/or distribute this software for any\r\npurpose with or without fee is hereby granted.\r\n\r\nTHE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH\r\nREGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY\r\nAND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,\r\nINDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM\r\nLOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR\r\nOTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR\r\nPERFORMANCE OF THIS SOFTWARE."
  }
];
