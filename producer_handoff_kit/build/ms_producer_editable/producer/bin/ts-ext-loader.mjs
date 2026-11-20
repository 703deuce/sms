// Resolve extensionless relative imports to .ts so we can load the 35e4a03
// contract files with Node's type-stripping, without installing tsx.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (typeof specifier === 'string' && /^\.\.?\//.test(specifier) && !/\.[A-Za-z0-9]+$/.test(specifier)) {
      return nextResolve(specifier + '.ts', context);
    }
    throw err;
  }
}
