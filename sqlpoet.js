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

  function inherits(child, parent) {
    child.prototype.__proto__ = parent.prototype;
  }

  return {
    escapeStr: escapeStr,
    naString: naString,
    naInt: naInt,
    isString: isString,
    isNumber: isNumber,
    inherits: inherits
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
    var s = this.lastToken_;
    this.lastToken_ = '';
    if (SQLPoet.isString(s) && /_$/.test(s)) {
      s = String.replace(s, /_$/, ',');
    }
    this.sql_.push(s);
  }

  function toSql(viewArgs, opt_generator) {
    if (this.lastToken_) {
      append_.call(this);
    }
    var str = '';
    var generator = opt_generator || makeArgNameGenerator();
    this.sql_.forEach(function(s) {
      if (s instanceof SQLPoet) {
        s = s.toSql(viewArgs, generator);
      } else if (s instanceof FunctionHandler) {
        s = s.handle(viewArgs, generator);
      }
      if (/[^ ,()]$/.test(str) && /^[^ ,()]/.test(s)) {
        s = ' ' + s;
      }
      str += s;
    });
    return str;
  }

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
    } else if (/^\$/.test(fnName)) {
      var token = handleFunction_(fnName, Array.prototype.slice.call(arguments));
      if (token) {
        this.lastToken_ = token;
      }
    } else {
      append_.call(this);
      this.lastToken_ = value;
    }
    append_.call(this);
  }

  function handleFunction_(fnName, args) {
    if (fnName == '$stringList') {
      return handleListFunction_('string', args);
    } else if (fnName == '$intList') {
      return handleListFunction_('int', args);
    } else if (fnName == '$list') {
      return handleRawListFunction_(args);
    } else if (fnName == '$baseTable') {
      return '${BASE_TABLE()}';
    } else if (fnName == '$table') {
      return '${TABLE_NAME(' + args[0] + ')}';
    } else if (fnName == '$schemaId') {
      return '${SCHEMA_ID(' + args[0] + ')}';
    } else if (fnName == '$define') {
// todo
    } else {
      return handleVarFunction_(fnName, args);
    }
    return '';
  }

  /**
   * @param {string} type string or int
   * @param {[string, string=, Object=]|[string, {argName: string=, value: Object=}=]} args
   * @return {ListFunctionHandler}
   */
  function handleListFunction_(type, args) {
    var colName = args[0];
    if (SQLPoet.isString(args[1])) {
      return new ListFunctionHandler(/*argName*/args[1], colName, type, /*value*/args[2]);
    } else if (args[1] != null) {
      var options = args[1];
      return new ListFunctionHandler(options.argName, colName, type, options.value);
    }
    return new ListFunctionHandler(/*argName*/null, colName, type, /*value*/null);
  }

  /**
   * @param {[string, string=, string=, Object=]|[string, {argName: string=, type: string, value: Object=}=]} args
   * @return {RawListFunctionHandler}
   */
  function handleRawListFunction_(args) {
    var colName = args[0];
    var argName, value, type;
    if (SQLPoet.isString(args[1])) {
      argName = args[1];
      value = args[2];
      type = args[3];
    } else if (args[1] != null) {
      var options = args[1];
      argName = options.argName;
      value = options.value;
      type = options.type;
    }
    if (value != null && type == null) {
      type = typeOf_(value);
    }
    if (type == null) {
      type = 'string';
    }
    return new RawListFunctionHandler(argName, colName, type, value);
  }

  /**
   * @param {string} fnName
   * @param {[Object=, string=, string=]|[Object=, {argName: string=, type: string, value: Object=}=]} args
   * @return {VarFunctionHandler}
   */
  function handleVarFunction_(fnName, args) {
    var value = args[0];
    var argName, type;
    if (SQLPoet.isString(args[1])) {
      type = args[1];
      argName = args[2];
    } else if (args[1] != null) {
      var options = args[1];
      type = options.type;
      argName = options.name;
    }
    if (!argName && fnName != '$var') {
      argName = String.replace(fnName, /^\$/, '');
    }
    if (value != null && type == null) {
      type = typeOf_(value);
    }
    return new VarFunctionHandler(argName, type, value);
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

  function FunctionHandler() {
  }
  FunctionHandler.prototype.handle = function(generator) {};

  function ListFunctionHandler(argName, colName, type, value) {
    this.argName_ = argName;
    this.colName_ = colName;
    this.type_ = type;
    this.value_ = value;
  }
  SQLPoet.inherits(ListFunctionHandler, FunctionHandler);
  ListFunctionHandler.prototype.handle = function(viewArgs, generator) {
    var argName = this.argName_ || generator();
    if (this.value_ != null) {
      addViewArgs_(viewArgs, this.type_, argName, this.value_);
    }
    if (this.type_ == 'int') {
      return '${INT_LIST(' + argName + ', ' + this.colName_ + ')}';
    }
    return '${STRING_LIST(' + argName + ', ' + this.colName_ + ')}';
  };

  function RawListFunctionHandler(argName, colName, type, value) {
    this.argName_ = argName;
    this.colName_ = colName;
    this.type_ = type;
    this.value_ = value;
  }
  SQLPoet.inherits(RawListFunctionHandler, FunctionHandler);
  RawListFunctionHandler.prototype.handle = function(viewArgs, generator) {
    var argName = this.argName_ || generator();
    if (this.value_ != null) {
      addViewArgs_(viewArgs, this.type_, argName, this.value_);
    }
    return '${LIST(' + argName + ', ' + this.type_ + ', ' + this.colName_ + ')}';
  };

  function VarFunctionHandler(argName, type, value) {
    this.argName_ = argName;
    this.type_ = type;
    this.value_ = value;
  }
  SQLPoet.inherits(VarFunctionHandler, FunctionHandler);
  VarFunctionHandler.prototype.handle = function(viewArgs, generator) {
    var argName = this.argName_ || generator();
    if (this.value_ != null) {
      addViewArgs_(viewArgs, this.type_, argName, this.value_);
    }
    return '${VAR(' + argName + ', ' + this.type_ + ')}';
  };

  function makeArgNameGenerator() {
    var i = 0;
    return function() {
      return '$arg-' + (i++);
    };
  }

  return function() {
    var obj = {
      sql_: [],
      lastToken_: ''
    };
    // TODO:
    // Cannot override property, length, arity, name, prototype, arguments.
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
