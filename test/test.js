//==================
// setup
//==================
SQLPoet.escapeStr = function(str) {
  return "'" + str.replace("'", "''") + "'";
};

SQLPoet.naString = function(array) {
  var javaArray = java.lang.reflect.Array.newInstance(java.lang.String, array.length);
  array.forEach(function(o, i) {
    javaArray[i] = java.lang.String.valueOf(o);
  });
  return javaArray;
};

SQLPoet.naInt = function(array) {
  var javaArray = java.lang.reflect.Array.newInstance(java.lang.Integer, array.length);
  array.forEach(function(o, i) {
    javaArray[i] = java.lang.Integer.valueOf(o^0);
  });
  return javaArray;
};


//==================
// doctest
//==================

var testFiles = new java.io.File(doctestpath).listFiles(new java.io.FileFilter({
  accept: function(file) {
    return /.doctest$/.test(file.getName());
  }
}));

testFiles.forEach(function(file) {
  print('[' + file.getName() + ']');
  doctest(readFile(file.getCanonicalPath()));
});
print('complite');