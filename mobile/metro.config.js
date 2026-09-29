// ADR-014: the app imports pure business logic from the repo root (lib/services, lib/validators)
// instead of copying it. Metro watches only those folders — never the root node_modules.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [path.join(repoRoot, 'lib', 'services'), path.join(repoRoot, 'lib', 'validators')]
// Shared files resolve their dependencies from the app's node_modules, not the web app's.
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')]

// `@/lib/...` → <repo>/lib/... (the same alias the web app and vitest use)
const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/lib/')) {
    const target = path.join(repoRoot, 'lib', moduleName.slice('@/lib/'.length))
    return context.resolveRequest(context, target, platform)
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
