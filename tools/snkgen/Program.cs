// Generates the strong-name key pair (.snk) for the Dataverse plug-in assembly.
// The key fixes the assembly identity across releases: store it in the vault /
// CI secret SX_PLUGIN_SNK_B64 and never commit it.
using System;
using System.IO;
using System.Security.Cryptography;

if (args.Length != 1) { Console.Error.WriteLine("usage: snkgen <output.snk>"); return 1; }
// Expand a leading "~" (cmd.exe and PowerShell pass it through literally).
var target = args[0];
if (target == "~" || target.StartsWith("~/") || target.StartsWith("~\\"))
    target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), target.Length > 2 ? target.Substring(2) : "");
target = Path.GetFullPath(target);
if (File.Exists(target)) { Console.Error.WriteLine("refusing to overwrite " + target); return 1; }
Directory.CreateDirectory(Path.GetDirectoryName(target)!);
using var rsa = new RSACryptoServiceProvider(2048);
File.WriteAllBytes(target, rsa.ExportCspBlob(true));
Console.WriteLine("strong-name key written to " + target);
return 0;
