module.exports = async function curry(node, args, ctx) {
  if (!node || node.type !== 'tool' ) {
    throw Error('curry can only modify tool') 
  }

  // parse args string to object
  // supports key=value pairs where value can be quoted string
  // keys can optionally start with $

  const parsedArgs = {};
  // regex to split on spaces but keep quoted substrings together
  const regex = /([^\s"']+|"[^"]*"|'[^']*')+/g;
  const tokens = args.match(regex) || [];

  tokens.forEach(token => {
    const equalIndex = token.indexOf('=');
    if (equalIndex > 0) {
      const key = token.substring(0, equalIndex);
      let value = token.substring(equalIndex + 1);

      // strip double or single quotes from value if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      parsedArgs[key] = value;
    }
  });
  const schema = { ...node.schema }
  const curryParams = {} 
  const newNode = { 
    ...node,
    schema,
    exec: async(params, ctx) => node.exec({...params, ...curryParams}, ctx)
  }
  for(const key in parsedArgs) {
    if (key.indexOf("$") === -1)  {
      curryParams[key] = parsedArgs[key]
      if (!schema.parameters.properties[key]) {
        throw Error(`parameter ${key} is not defined in ${node.name}'s schema`)
      }
      delete schema.parameters.properties[key]
      const idx = (schema.parameters.required || []).indexOf(key)
      if (idx !== -1) {
        schema.parameters.required.splice(idx, 1)
      }
    } else {
      const path = key.slice(1).split(".")
      if (path[0] !== "name" && path[0] !== "description") {
        throw Error(`path should start with $name or with $description`)
      }
      newNode[path[0]] = parsedArgs[key]
    }
  }

  return newNode 
}
