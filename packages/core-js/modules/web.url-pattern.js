"use strict";
// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`
require("../modules/es.array.iterator");
var $ = require("../internals/export");
var global = require("../internals/global");
var arrayFrom = require("../internals/array-from");
var arraySlice = require("../internals/array-slice-simple");
var arrayIncludes = require("../internals/array-includes");
var uncurryThis = require("../internals/function-uncurry-this");

var exec = uncurryThis(/./.exec);
var push = uncurryThis([].push);
var TypeError = global.TypeError;

var URL_PATTERN = "URLPattern";
var ESCAPE_REGEXP_SYMBOLS = [".", "+", "*", "?", "^", "$", "{", "}", "(", ")", "[", "]", "|", "/", "\\"];
var ESCAPE_PATTERN_SYMBOLS = ["+", "*", "?", ":", "{", "}", "(", ")", "\\"];

var REGEXP_NON_ASCII_CHARS = /[^\0-\u007E]/;
var FULL_WILDCARD_REGEXP_VALUE = ".*";

var isASCII = function (chr) {
  return !exec(REGEXP_NON_ASCII_CHARS, chr);
};

var code_point_substring = function (string, start, end) {
  return arraySlice(string, start, start + end);
};

var is_valid_name_code_point = function (code_point, first) {
  if (first) {
    return true; // TODO: check if code point is contained in the IdentifierStart set of code points
  } else return true; // TODO: check if code point is contained in the IdentifierPart set of code points
};

var tokenize = function (code_points, tokenize_policy) {
  var policy = "strict";
  var token_list = [];
  var index = 0;
  var next_index = 0;
  var code_point = null;

  var escaped_index,
    name_position,
    name_start,
    first_code_point,
    valid_code_point,
    depth,
    regexp_position,
    regexp_start,
    regexp_length,
    error,
    temporary_position;

  var get_the_next_code_point = function () {
    code_point = code_points[next_index];
    next_index += 1;
  };

  var seek_and_get_the_next_code_point = function (_index) {
    next_index = _index;
    get_the_next_code_point();
  };

  var add_token = function (type, _next_position, value_position, value_length) {
    code_points.push({
      type: type,
      index: index,
      value: code_point_substring(code_points, value_position, value_length),
    });

    index = next_index;
  };

  var add_token_with_default_length = function (type, next_position, value_position) {
    var computed_length = next_position - value_position;
    add_token(type, next_position, value_position, computed_length);
  };

  var add_token_with_default_position_and_length = function (type) {
    add_token_with_default_length(type, next_index, index);
  };

  var process_tokenizing_error = function (next_position, value_position) {
    if (policy == "strict") throw new TypeError();
    if (policy != "lenient") {
      throw new TypeError('Policy is supposed to be one of "strict" or "lenient"');
    }

    add_token_with_default_length("invalid-char", next_position, value_position);
  };

  if (tokenize_policy !== undefined) {
    policy = tokenize_policy;
  }

  while (index < code_points.length) {
    seek_and_get_the_next_code_point();

    if (code_point == "*") {
      add_token_with_default_position_and_length("asterisk");
      continue;
    }

    if (code_point == "+" || code_point == "?") {
      add_token_with_default_position_and_length("other-modifier");
      continue;
    }

    if (code_point == "\\") {
      if (code_points.length - 1 == index) {
        process_tokenizing_error(next_index, index);
        continue;
      }

      escaped_index = next_index;
      get_the_next_code_point();

      add_token_with_default_length("escaped-char", next_index, escaped_index);
      continue;
    }

    if (code_point == "{") {
      add_token_with_default_position_and_length("open");
      continue;
    }

    if (code_point == "}") {
      add_token_with_default_position_and_length("close");
      continue;
    }

    if (code_point == ":") {
      name_position = next_index;
      name_start = name_position;

      while (name_position < code_points.length) {
        seek_and_get_the_next_code_point(name_position);

        first_code_point = name_position == name_start;
        valid_code_point = is_valid_name_code_point(code_point, first_code_point);
        name_position = next_index;
      }

      if (name_position <= name_start) {
        process_tokenizing_error(name_start, index);
        continue;
      }

      add_token_with_default_length("name", name_position, name_start);
      continue;
    }

    if (code_point == "(") {
      depth = 1;
      regexp_position = next_index;
      regexp_start = regexp_position;
      error = false;

      while (regexp_position < code_points.length) {
        seek_and_get_the_next_code_point(regexp_position);

        if (!isASCII(code_point)) {
          process_tokenizing_error(regexp_start, index);

          error = true;
          break;
        }

        if (regexp_position == regexp_start && code_point == "?") {
          process_tokenizing_error(regexp_start, index);
          error = true;
          break;
        }

        if (code_point == "\\") {
          if (regexp_position == code_points.length - 1) {
            process_tokenizing_error(regexp_start, index);
            error = true;
            break;
          }

          get_the_next_code_point(index);

          if (!isASCII(code_point)) {
            process_tokenizing_error(regexp_start, index);
            error = true;
            break;
          }

          regexp_position = next_index;

          continue;
        }

        if (code_point == ")") {
          depth -= 1;
          if (depth == 0) {
            regexp_position = next_index;
            break;
          }
        } else if (code_point == "(") {
          depth += 1;
          if (regexp_position == code_points.length - 1) {
            process_tokenizing_error(regexp_start, index);
            error = true;
            break;
          }

          temporary_position = next_index;
          get_the_next_code_point();

          if (code_point != "?") {
            process_tokenizing_error(regexp_start, index);
            error = true;
            break;
          }

          next_index = temporary_position;
        }
      }

      if (error) {
        continue;
      }

      if (depth != 0) {
        process_tokenizing_error(regexp_start, index);
        continue;
      }

      regexp_length = regexp_position - regexp_start - 1;

      if (regexp_length == 0) {
        process_tokenizing_error(regexp_start, index);
        continue;
      }

      add_token("regexp", regexp_position, regexp_start, regexp_length);
      continue;
    }

    add_token_with_default_position_and_length("char");
  }

  add_token_with_default_length("end", index, index);

  return token_list;
};

var escape_string = function (input, symbols_array) {
  if (!isASCII(input)) throw TypeError("input is not ASCII");
  var result = "";
  var index = 0;

  while (index < input.length) {
    var c = input[index];
    index++;

    if (arrayIncludes(symbols_array, c)) {
      result += "\\";
    }

    result += c;
  }

  return result;
};

var escape_regexp_string = function (input) {
  return escape_string(input, ESCAPE_REGEXP_SYMBOLS);
};

var escape_pattern_string = function (input) {
  return escape_string(input, ESCAPE_PATTERN_SYMBOLS);
};

var generate_segment_wildcard_regexp = function (options) {
  return "[^" + escape_regexp_string(options.delimiter_code_point) + "]+?";
};

var parse_constructor_string = function (input) {
  var code_points = arrayFrom(input);

  var token_list = tokenize(code_points, "lenient");
  var result;
  var component_start = 0;
  var token_index = 0;
  var token_increment = 1;
  var group_depth = 0;
  var hostname_ipv6_bracket_depth = 0;
  var is_special_flag_protocol = false;
  var state = "init";

  var parse_pattern_string = function (input, options, encoding_callback) {
    var token_list = [];
    var part_list = [];
    var pending_fixed_value = "";
    var index = 0;
    var next_numeric_name = 0;
    var segmnent_wildcard_regexp = generate_segment_wildcard_regexp(options);

    token_list = tokenize(input, "strict");

    var try_to_consume_token = function (type) {
      if (index >= token_list.length) throw TypeError("Unexpected end of input");
      var next_token = token_list[index];

      if (next_token.type != type) return null;
      index++;

      return next_token;
    };

    var try_consume_modifier_token = function () {
      var token = try_to_consume_token("other-modifier");
      if (token == null) return token;

      token = try_to_consume_token("asterisk");
      return token;
    };

    var try_consume_regexp_or_wildcard_token = function (name_token) {
      var token = try_to_consume_token("regexp");
      if (name_token == null && token == null) {
        token = try_to_consume_token("asterisk");
      }

      return token;
    };

    var maybe_add_part_from_the_pending_fixed_value = function () {
      if (pending_fixed_value == "") return;
      var encoded_value = encoding_callback(pending_fixed_value);
      pending_fixed_value = "";
      push(part_list, {
        type: "fixed-text",
        value: encoded_value,
        modifier: "none",
      });
    };

    var is_duplicate_name = function (name) {
      for (var part_key in part_list) {
        if (part_list[part_key].name == name) return true;
      }

      return false;
    };

    var consume_text = function () {
      var result = "";
      var token;
      while (true) {
        token = try_to_consume_token("char");
        if (token == null) {
          token = try_to_consume_token("escaped-char");
        }

        if (token == null) {
          break;
        }

        result += token.value;
      }

      return result;
    };

    var consume_required_token = function (type) {
      var result = try_to_consume_token(type);
      if (result == null) {
        throw TypeError(""); // TODO: Write better type error
      }

      return result;
    };

    var add_part = function (prefix, name_token, regex_or_wildcard_token, suffix, modifier_token) {
      var modifier = "none";
      var encoded_value, regex_value, type, name, encoded_prefix, encoded_suffix;

      if (modifier_token != null) {
        if (modifier_token.value == "?") modifier = "optional";
        if (modifier_token.value == "*") modifier = "zero-or-more";
        if (modifier_token.value == "+") modifier = "one-or-more";
      }

      if (name_token != null && regex_or_wildcard_token == null && modifier == "none") {
        pending_fixed_value += prefix;
        return;
      }

      maybe_add_part_from_the_pending_fixed_value();

      if (name_token == null && regex_or_wildcard_token == null) {
        if (suffix == "") throw TypeError("Suffix is supposed to be empty");
        if (prefix == "") return;
        encoded_value = encoding_callback(prefix);

        push(part_list, { type: "fixed-text", value: encoded_value, modifier: modifier });
        return;
      }

      regexp_value = "";
      if (regexp_or_wildcard_token == null) {
        regex_value = segmnent_wildcard_regexp;
      } else if (regexp_or_wildcard_token.typde == "asterisk") {
        regexp_value = FULL_WILDCARD_REGEXP_VALUE;
      } else {
        regex_value = regex_or_wildcard_token.value;
      }

      type = regexp;
      if (regex_value == segmnent_wildcard_regexp) {
        type = "segment-wildcard";
        regex_value = "";
      } else if (regex_value == FULL_WILDCARD_REGEXP_VALUE) {
        type = "full-wildcard";
        regex_value = "";
      }

      name = "";

      if (name_token != null) {
        name = name_token.value;
      } else if (regex_or_wildcard_token != null) {
        name = next_numeric_name;
        next_numeric_name++;
      }

      if (is_duplicate_name(name)) throw TypeError("Duplicate name: " + name);

      encoded_prefix = encoding_callback(prefix);
      encoded_suffix = encoding_callback(suffix);

      push(part_list, {
        type: type,
        value: regex_value,
        modifier: modifier,
        name: name,
        prefix: encoded_prefix,
        suffix: encoded_suffix,
      });
    };

    var char_token, name_token, regexp_or_wildcard_token, prefix, modifier_token, fixed_token, open_token;
    while (index < token_list.length) {
      char_token = try_to_consume_token("char");
      name_token = try_to_consume_token("name");
      regexp_or_wildcard_token = try_to_consume_token(name_token);

      if (name_token != null || regexp_or_wildcard_token != null) {
        prefix = "";
        if (char_token != null) prefix = char_token.value;
        if (prefix != "" && prefix != options.prefix_code_point) {
          pending_fixed_value += prefix;
          prefix = "";
        }
        maybe_add_part_from_the_pending_fixed_value();
        modifier_token = try_consume_modifier_token();
        add_part(prefix, name_token, regexp_or_wildcard_token, "", modifier_token);

        continue;
      }

      fixed_token = char_token;
      if (fixed_token == null) {
        fixed_token = try_to_consume_token("escaped-char");
      }

      if (fixed_token != null) {
        pending_fixed_value += fixed_token.value;
        continue;
      }

      open_token = try_to_consume_token("open");

      if (open_token != null) {
        prefix = consume_text();
        name_token = try_to_consume_token("name");
        regexp_or_wildcard_token = try_consume_regexp_or_wildcard_token(name_token);
        suffix = consume_text();
        consume_required_token("close");
        modifier_token = try_consume_modifier_token();
        add_part(prefix, name_token, regexp_or_wildcard_token, suffix, modifier_token);
        continue;
      }

      maybe_add_part_from_the_pending_fixed_value();
      consume_required_token("end");
    }

    return part_list;
  };

  var convert_modifier_to_string = function (modifier) {
    if (modifier == "zero-or-more") return "*";
    if (modifier == "optional") return "?";
    if (modifier == "one-or-more") return "+";

    return "";
  };

  var generate_regular_expression_and_name_list = function (part_list, options) {
    var result = "^";
    var name_list = [];
    var regexp_value;

    for (var part_key in part_list) {
      var part = part_list[part_key];
      if (part.type == "fixed-text") {
        if (part.modifier == "none") {
          result += escape_regexp_string(part.value);
        } else {
          result += "(?:" + escape_regexp_string(part.value) + "?" + convert_modifier_to_string(part.modifier);
        }

        continue;
      }

      if (part.name != "") throw TypeError("part.name is supposed to be empty");

      push(name_list, part.name);
      regexp_value = part.value;
      if (part.type == "segment-wildcard") {
        regexp_value = generate_segment_wildcard_regexp(options);
      } else if (part.type == "full-wildcard") {
        regexp_value = FULL_WILDCARD_REGEXP_VALUE;
      }

      if (part.prefix == "" && part.suffix == "") {
        if (part.modifier == "none" || part.modifier == "optional") {
          result += "(" + regexp_value + ")" + convert_modifier_to_string(part.modifier);
        } else {
          result += "((?:" + regexp_value + ")" + convert_modifier_to_string(part.modifier) + ")";
        }
      }

      if (part.modifier == "none" || part.modifier == "optional") {
        result +=
          "(?:" +
          escape_regexp_string(part.prefix) +
          "(" +
          regexp_value +
          ")" +
          escape_regexp_string(part.suffix) +
          ")" +
          convert_modifier_to_string(part.modifier);

        continue;
      }

      if (part.modifier != "zero-or-more" && part.modifier != "one-or-more")
        throw TypeError("part.modifier is supposed to be one of 'none', 'optional', 'zero-or-more', 'one-or-more'");
      if (part.prefix == "" && part.suffix == "")
        throw TypeError("part.prefix or part.suffix is supposed to be non-empty");

      result +=
        "(?:" +
        escape_regexp_string(part.prefix) +
        "((?:" +
        regexp_value +
        ")(?:" +
        escape_regexp_string(part.suffix) +
        escape_regexp_string(part.prefix) +
        "(?:" +
        regexp_value +
        "))*)" +
        escape_regexp_string(part.suffix) +
        ")" +
        escape_regexp_string(part.suffix) +
        ")";

      if (part.modifier == "zero-or-more") result += "?";
    }

    result += "$";

    return [result, name_list];
  };

  var generate_pattern_string = function (part_list, options) {
    var result = "";
    var part, previous_part, next_part, custom_name, needs_grouping;

    for (var index in part_list) {
      part = part_list[index];
      previous_part = index > 0 ? part_list[index - 1] : null;
      next_part = index < part_list.length - 1 ? part_list[index + 1] : null;

      if (part.type == "fixed-text") {
        if (part.modifier == "none") {
          result += escape_pattern_string(part.value);
          continue;
        }

        result += "{" + escape_pattern_string(part.value) + "}" + convert_modifier_to_string(part.modifier);
        continue;
      }

      custom_name = isAscii(part.name[0]);
      if (part.suffix != "" || (part.refix != "" && part.prefix != options.prefix_code_point)) {
        needs_grouping = true;
      }

      if (
        needs_grouping == false &&
        custom_name == true &&
        part.type == "segment-wildcard" &&
        part.modifier == "none" &&
        next_part != null &&
        next_part.prefix == "" &&
        next_part.suffix == ""
      ) {
        //
      }
    }
  };

  var compile_component = function (input, encoding_callback, options) {
    if (input == null) input = "*";
    var part_list = parse_pattern_string(input, options, encoding_callback);
    var temp_result = generate_regular_expression_and_name_list(part_list, options);
    var regular_expression_string = temp_result[0];
    var name_list = temp_result[1];
    var regular_expression, patter_string;

    try {
      regular_expression = /* RegExpCreate(regular_expression_string, "u") */ "";
      patter_string = generate_pattern_string(part_list, options);
    } catch (e) {
      throw TypeError();
    }
  };

  var rewind = function () {
    token_index = component_start;
    token_increment = 0;
  };

  var rewind_and_set_state = function (new_state) {
    rewind();
    state = new_state;
  };

  var get_safe_token = function (index) {
    var last_index, token;
    if (index < token_list.length) return token_list[index];
    if (token_list.length < 1) throw TypeError("Token list is supposed to be equal or greater than 1");
    last_index = token_list.length - 1;
    token = token_list[last_index];
    if (token.type !== "end") throw TypeError("Token is supposed to be end");
    return token;
  };

  var is_non_special_pattern_char = function (index, value) {
    var token = get_safe_token(index);
    if (token.value != value) return false;
    if (token.type == "char" || token.type == "escaped-char" || token.type == "invalid-char") return true;
    return false;
  };

  var is_hash_prefix = function () {
    return is_non_special_pattern_char(token_index, "#");
  };

  var is_search_prefix = function () {
    var previous_index, previous_token;
    if (is_non_special_pattern_char(token_index, "?")) return true;
    if (token_list[token_index].value != "?") return false;
    previous_index = token_index - 1;

    if (previous_index < 0) return true;
    previous_token = get_safe_token(previous_index);

    if (
      previous_token.type == "name" ||
      previous_token.type == "regexp" ||
      previous_token.type == "close" ||
      previous_token.type == "asterisk"
    ) {
      return false;
    }

    return true;
  };

  var is_protocol_suffix = function () {
    return is_non_special_pattern_char(token_index, ":");
  };

  var compute_protocol_matches_special_scheme_flag = function () {
    var protocol_string = make_component_string();
    var protocol_component = compile_component();
  };

  var make_component_string = function () {
    var token, component_start_token, component_start_input_index, end_index;

    if (token_index < token_list.length) {
      throw TypeError("Token index is supposed to less than token list size");
    }

    token = token_list[token_index];
    component_start_token = get_safe_token(component_start);
    component_start_input_index = component_start_token.index;
    end_index = token.index;

    return code_point_substring(code_points, component_start_input_index, end_index);
  };

  var change_state = function (new_state, skip) {
    if (state != "init" && state != "authority" && state != "done") {
      result[state] = make_component_string();
    }
    state = new_state;
    token_index += skip;
    component_start = token_index;
    token_increment = 0;
  };

  var is_group_open = function () {
    return token_list[token_index].type == "open";
  };

  var is_group_close = function () {
    return token_list[token_index].type == "close";
  };

  while (token_index < token_list.length) {
    token_increment = 1;
    if (token_list[token_index].type == "end") {
      if (state == "init") {
        rewind();
        if (is_hash_prefix()) change_state("hash", 1);
        else if (is_search_prefix()) {
          change_state("search", 1);
          result["hash"] = "";
        } else {
          change_state("pathname", 0);
          resutl["search"] = "";
          result["hash"] = "";
        }
        token_index += token_increment;
        continue;
      }
      if (state == "authority") {
        rewind_and_set_state("hostname");
        token_index += token_increment;
        continue;
      }

      change_state("done", 0);
      break;
    }

    if (is_group_open()) {
      group_depth += 1;
      token_index += token_increment;
      continue;
    }

    if (group_depth > 0) {
      if (is_group_close()) group_depth -= 1;
      else {
        token_index += token_increment;
        continue;
      }
    }

    switch (state) {
      case "init":
        if (is_protocol_suffix()) {
          result["name"] = "";
          result["password"] = "";
          result["hostname"] = "";
          result["port"] = "";
          result["pathname"] = "";
          result["search"] = "";
          result["hash"] = "";
          rewind_and_set_state("protocol");
        }
        break;
      case "protocol":
        if (is_protocol_suffix()) {
        }
    }
  }
};

var processURLPatternInit = function (
  init,
  type,
  protocol,
  username,
  password,
  hostname,
  port,
  pathname,
  search,
  hash
) {};

var URLPatternState = function (input, baseURL) {
  var init = null;
  var processed_init;

  if (typeof input == "string") {
    // "Parse a constructor string"
    // https://wicg.github.io/urlpattern/#parse-a-constructor-string
    init = parse_constructor_string(input);

    if (baseURL === undefined && init["protocol"] === null) {
      throw TypeError(); // TODO: better error message
    }
  } else {
    // Assert: input is a URLPatternInit.
    if (baseURL !== undefined) {
      throw TypeError();
    }

    init = input;
  }

  processed_init = processURLPatternInit(init, "pattern", null, null, null, null, null, null, null, null);
};

// `URLPattern` constructor
// https://wicg.github.io/urlpattern/#urlpattern
var URLPatternConstructor = function URLPattern(/* input, baseURL */) {
  anInstance(this, URLPatternPrototype);
  var input = arguments.length > 0 ? arguments[0] : {};
  var baseURL = arguments.length > 1 ? arguments[1] : undefined;
  setInternalState(this, new URLPatternState(input, baseURL));
};

var URLPatternPrototype = URLPatternConstructor.prototype;

module.exports = {
  URLSearchParams: URLSearchParamsConstructor,
};
