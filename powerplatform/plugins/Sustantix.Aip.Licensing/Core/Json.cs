using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Sustantix.Aip.Licensing.Core
{
    public enum JsonKind { Null, Bool, Number, String, Array, Object }

    /// <summary>
    /// A parsed JSON value. Numbers keep their source text, so amounts convert to decimal exactly and never pass
    /// through floating point. Used for change sets and the embedded change model, whose shapes are open-ended.
    /// </summary>
    public sealed class JsonValue
    {
        public JsonKind Kind { get; private set; }
        public string Text { get; private set; }
        public bool Bool { get; private set; }
        public List<JsonValue> Items { get; private set; }
        public Dictionary<string, JsonValue> Fields { get; private set; }

        public static readonly JsonValue Null = new JsonValue { Kind = JsonKind.Null };

        public static JsonValue Str(string s) { return new JsonValue { Kind = JsonKind.String, Text = s }; }
        public static JsonValue Num(string raw) { return new JsonValue { Kind = JsonKind.Number, Text = raw }; }
        public static JsonValue Boolean(bool b) { return new JsonValue { Kind = JsonKind.Bool, Bool = b }; }
        public static JsonValue Arr(List<JsonValue> items) { return new JsonValue { Kind = JsonKind.Array, Items = items }; }
        public static JsonValue Obj(Dictionary<string, JsonValue> fields) { return new JsonValue { Kind = JsonKind.Object, Fields = fields }; }

        public JsonValue this[string key]
        {
            get
            {
                JsonValue v;
                return Kind == JsonKind.Object && Fields.TryGetValue(key, out v) ? v : Null;
            }
        }

        public string AsString() { return Kind == JsonKind.String ? Text : null; }

        public static JsonValue Parse(string json)
        {
            if (json == null) throw new FormatException("no JSON");
            var p = new Reader(json);
            var v = p.Value(0);
            p.SkipSpace();
            if (!p.End) throw new FormatException("unexpected text after JSON at " + p.Pos);
            return v;
        }

        public override string ToString()
        {
            var sb = new StringBuilder();
            Write(sb);
            return sb.ToString();
        }

        private void Write(StringBuilder sb)
        {
            switch (Kind)
            {
                case JsonKind.Null: sb.Append("null"); break;
                case JsonKind.Bool: sb.Append(Bool ? "true" : "false"); break;
                case JsonKind.Number: sb.Append(Text); break;
                case JsonKind.String: Quote(sb, Text); break;
                case JsonKind.Array:
                    sb.Append('[');
                    for (var i = 0; i < Items.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        Items[i].Write(sb);
                    }
                    sb.Append(']');
                    break;
                default:
                    sb.Append('{');
                    var first = true;
                    foreach (var kv in Fields)
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        Quote(sb, kv.Key);
                        sb.Append(':');
                        kv.Value.Write(sb);
                    }
                    sb.Append('}');
                    break;
            }
        }

        public static void Quote(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        private sealed class Reader
        {
            private const int MaxDepth = 64;
            private readonly string _s;
            public int Pos;

            public Reader(string s) { _s = s; }
            public bool End { get { return Pos >= _s.Length; } }

            public void SkipSpace()
            {
                while (Pos < _s.Length && (_s[Pos] == ' ' || _s[Pos] == '\t' || _s[Pos] == '\n' || _s[Pos] == '\r')) Pos++;
            }

            public JsonValue Value(int depth)
            {
                if (depth > MaxDepth) throw new FormatException("JSON nested too deeply");
                SkipSpace();
                if (End) throw new FormatException("unexpected end of JSON");
                var c = _s[Pos];
                if (c == '{') return Object(depth);
                if (c == '[') return Array(depth);
                if (c == '"') return Str(StringToken());
                if (c == 't') { Expect("true"); return Boolean(true); }
                if (c == 'f') { Expect("false"); return Boolean(false); }
                if (c == 'n') { Expect("null"); return Null; }
                return Num(NumberToken());
            }

            private void Expect(string word)
            {
                if (string.CompareOrdinal(_s, Pos, word, 0, word.Length) != 0) throw new FormatException("invalid JSON at " + Pos);
                Pos += word.Length;
            }

            private JsonValue Object(int depth)
            {
                Pos++;
                var fields = new Dictionary<string, JsonValue>(StringComparer.Ordinal);
                SkipSpace();
                if (!End && _s[Pos] == '}') { Pos++; return Obj(fields); }
                while (true)
                {
                    SkipSpace();
                    if (End || _s[Pos] != '"') throw new FormatException("expected a property name at " + Pos);
                    var key = StringToken();
                    SkipSpace();
                    if (End || _s[Pos] != ':') throw new FormatException("expected ':' at " + Pos);
                    Pos++;
                    fields[key] = Value(depth + 1);
                    SkipSpace();
                    if (End) throw new FormatException("unterminated object");
                    if (_s[Pos] == ',') { Pos++; continue; }
                    if (_s[Pos] == '}') { Pos++; return Obj(fields); }
                    throw new FormatException("expected ',' or '}' at " + Pos);
                }
            }

            private JsonValue Array(int depth)
            {
                Pos++;
                var items = new List<JsonValue>();
                SkipSpace();
                if (!End && _s[Pos] == ']') { Pos++; return Arr(items); }
                while (true)
                {
                    items.Add(Value(depth + 1));
                    SkipSpace();
                    if (End) throw new FormatException("unterminated array");
                    if (_s[Pos] == ',') { Pos++; continue; }
                    if (_s[Pos] == ']') { Pos++; return Arr(items); }
                    throw new FormatException("expected ',' or ']' at " + Pos);
                }
            }

            private string StringToken()
            {
                Pos++;
                var sb = new StringBuilder();
                while (true)
                {
                    if (End) throw new FormatException("unterminated string");
                    var c = _s[Pos++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (End) throw new FormatException("unterminated escape");
                    var e = _s[Pos++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (Pos + 4 > _s.Length) throw new FormatException("bad unicode escape");
                            sb.Append((char)int.Parse(_s.Substring(Pos, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            Pos += 4;
                            break;
                        default: throw new FormatException("bad escape at " + Pos);
                    }
                }
            }

            private string NumberToken()
            {
                var start = Pos;
                if (Pos < _s.Length && _s[Pos] == '-') Pos++;
                while (Pos < _s.Length && (char.IsDigit(_s[Pos]) || _s[Pos] == '.' || _s[Pos] == 'e' || _s[Pos] == 'E' || _s[Pos] == '+' || _s[Pos] == '-')) Pos++;
                var raw = _s.Substring(start, Pos - start);
                decimal ignored;
                double d;
                if (raw.Length == 0 || !(decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out ignored) || double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out d)))
                    throw new FormatException("invalid number at " + start);
                return raw;
            }
        }
    }
}
