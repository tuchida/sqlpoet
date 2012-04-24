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

  function call_(value, options) {
    var fnName = this.lastToken_;
    var name = (options && options.name) || fnName;
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
      name = String.replace(name, /^\$/, '');
      if (fnName == '$table') {
        this.lastToken_ = '${TABLE_NAME(' + value + ')}';
      } else if (fnName == '$schemaId') {
        this.lastToken_ = '${SCHEMA_ID(' + value + ')}';
      } else {
        if (!Array.isArray(value)) {
          value = [value];
        }
        var type = 'string';
        if (options && options.type) {
          type = options.type;
        } else if (value.length > 0) {
          if (SQLPoet.isNumber(value[0])) {
            type = 'int';
          }
// todo support Date
        }
        if (type == 'int') {
          this.args_.put(name, SQLPoet.naInt(value));
          this.lastToken_ = '${VAR(' + name + ', int)}';
        } else {
          this.args_.put(name, SQLPoet.naString(value));
          this.lastToken_ = '${VAR(' + name + ', string)}';
        }
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
