var SQLPoet = (function() {
  var agn = com.arielnetworks.agn;
  var DbUtils = agn.util.DbUtils;

  function escapeStr(str) {
    return DbUtils.str(str);
  }

  function naString(array) {
    return util.naString(array);
  }

  function naInt(array) {
    return util.naInt(array);
  }

  function isString(o) {
    return typeof o == 'string' || o instanceof java.lang.String;
  }

  function isNumber(o) {
    return typeof o == 'number' || o instanceof java.lang.Number;
  }

  return {
    escapeStr: escapeStr,
    naString: naString,
    naInt: naInt,
    isString: isString,
    isNumber: isNumber
  };
})();

SQLPoet.create = (function() {

  function get(name) {
    append_.call(this);
    this.lastToken_ = name;
  }

  function append_() {
    if (!this.lastToken_) {
      return;
    }
    var str = this.lastToken_;
    this.lastToken_ = '';

    if (/_$/.test(str)) {
      str = String.replace(str, /_$/, ',');
    }
    if (/[^ ,()]$/.test(this.sql_) && /^[^ ,()]/.test(str)) {
      str = ' ' + str;
    }
    this.sql_ += str;
  };

  function toSql() {
    if (this.lastToken_) {
      append_.call(this);
    }
    return this.sql_;
  };

  function call_(value, var_args) {
    var fnName = this.lastToken_;
    if (/\$$/.test(fnName)) {
      this.lastToken_ = String.replace(fnName, /\$$/, '');
      append_.call(this);
      if (SQLPoet.isString(value)) {
        this.lastToken_ = SQLPoet.escapeStr(value);
      } else {
        this.lastToken_ = String(value);
      }
// todo support Date
    } else if (/^\$/.test(fnName)) {
      var token = handleFunction_(fnName, this.args_, Array.prototype.slice.call(arguments));
      if (token) {
        this.lastToken_ = token;
      }
    } else {
      append_.call(this);
      if (value instanceof SQLPoet) {
        value = value.toSql();
      }
      this.lastToken_ = value;
    }
    append_.call(this);
  };

  function handleFunction_(fnName, viewArgs, args) {
    if (fnName == '$stringList') {
      return handleListFunction_('string', viewArgs, args);
    } else if (fnName == '$intList') {
      return handleListFunction_('int', viewArgs, args);
    } else if (fnName == '$list') {
      return handleRawListFunction_(viewArgs, args);
    } else if (fnName == '$baseTable') {
      return '${BASE_TABLE()}';
    } else if (fnName == '$table') {
      return '${TABLE_NAME(' + args[0] + ')}';
    } else if (fnName == '$schemaId') {
      return '${SCHEMA_ID(' + args[0] + ')}';
    } else if (fnName == '$define') {
// todo
    } else {
      var value = args[0];
      var options = args[1];
      var name = (options && options.name) || fnName;
      name = String.replace(name, /^\$/, '');
      var type;
      if (options && options.type) {
        type = options.type;
      } else if (value != null) {
        type = typeOf_(value);
// todo support Date
      }
      // if (fnName == '$var') {
      //   name = options && options.name;
      // }
      // if (!name) {
      //   name = generator();
      // }
      if (value != null) {
        addViewArgs_(viewArgs, type, name, value);
      }
      if (type == 'int') {
        return '${VAR(' + name + ', int)}';
      } else {
        return '${VAR(' + name + ', string)}';
      }
    }
    return '';
  }

  function handleListFunction_(type, viewArgs, args) {
    var colName = args[0];
    var argName, value;
    if (SQLPoet.isString(args[1])) {
      argName = args[1];
      if (args[2] != null) {
        value = args[2];
      }
    } else if (args[1] != null) {
      var options = args[1];
      if (options.argName) {
        argName = options.argName;
      }
      if (options.value) {
        value = options.value;
      }
    }
    // if (!argName) {
    //   argName = generator();
    // }
    if (value != null) {
      addViewArgs_(viewArgs, type, argName, value);
    }
    if (type == 'int') {
      return '${INT_LIST(' + argName + ', ' + colName + ')}';
    } else {
      return '${STRING_LIST(' + argName + ', ' + colName + ')}';
    }
  }

  function handleRawListFunction_(viewArgs, args) {
    var colName = args[0];
    var argName, value, type;
    if (SQLPoet.isString(args[1])) {
      argName = args[1];
      if (args[2] != null) {
        value = args[2];
      }
      if (args[3] != null) {
        type = args[3];
      }
    } else if (args[1] != null) {
      var options = args[1];
      if (options.argName) {
        argName = options.argName;
      }
      if (options.value) {
        value = options.value;
      }
      if (options.type) {
        type = options.type;
      }
    }
    if (value != null && type == null) {
      type = typeOf_(value);
    }
    if (type == null) {
      type = 'string';
    }
    if (value != null) {
      addViewArgs_(viewArgs, type, argName, value);
    }
    // if (!argName) {
    //   argName = generator();
    // }
    return '${LIST(' + argName + ', ' + type + ', ' + colName + ')}';
  }

  function addViewArgs_(args, type, name, value) {
    if (!Array.isArray(value)) {
      value = [value];
    }
    if (type == 'int') {
      args.put(name, SQLPoet.naInt(value));
    } else {
      args.put(name, SQLPoet.naString(value));
    }
  }

  function typeOf_(value) {
    if (Array.isArray(value)) {
      value = value[0];
    }
    if (SQLPoet.isNumber(value)) {
      return 'int';
    }
    return 'string';
  }

  return function(args) {
    var obj = {
      args_: args,
      sql_: '',
      lastToken_: ''
    };
    var call = function() {
      call_.apply(obj, arguments);
      return call;
    };
    call.__proto__ = new JavaAdapter(org.mozilla.javascript.Scriptable, {
      get: function(name, start) {
        if (name == 'toSql') {
          return toSql.bind(obj);
        }
        get.call(obj, name);
        return call;
      },
      getPrototype: function() {
        return SQLPoet;
      }
    });
    return call;
  };
})();
