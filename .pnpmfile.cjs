// TypeScript 7 (the native compiler) no longer ships the JS compiler API that
// typescript-eslint loads, so `eslint` crashes on startup when its parser
// picks up the project's `typescript@7` peer. Keep TS 7 for the project, but
// give typescript-eslint's packages their own TS 5 as a regular dependency.
// Drop this once typescript-eslint supports TypeScript 7.
const TS_FOR_ESLINT = '5.9.3';

function readPackage(pkg) {
  if (pkg.name?.startsWith('@typescript-eslint/') || pkg.name === 'ts-api-utils') {
    if (pkg.peerDependencies?.typescript) {
      delete pkg.peerDependencies.typescript;
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript;
      pkg.dependencies = { ...pkg.dependencies, typescript: TS_FOR_ESLINT };
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
