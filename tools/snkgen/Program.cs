// Generates the strong-name key pair (.snk) for the Dataverse plug-in assembly.
// The key fixes the assembly identity across releases: store it in the vault /
// CI secret SX_PLUGIN_SNK_B64 and never commit it.
using System;
using System.IO;
using System.Security.Cryptography;

if (args.Length != 1) { Console.Error.WriteLine("usage: snkgen <output.snk>"); return 1; }
if (File.Exists(args[0])) { Console.Error.WriteLine("refusing to overwrite " + args[0]); return 1; }
using var rsa = new RSACryptoServiceProvider(2048);
File.WriteAllBytes(args[0], rsa.ExportCspBlob(true));
Console.WriteLine("strong-name key written to " + args[0]);
return 0;
