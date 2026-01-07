const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function stripIosEntitlements(config) {
  return withEntitlementsPlist(config, configMod => {
    const entitlements = configMod.modResults;
    delete entitlements["com.apple.developer.applesignin"];
    delete entitlements["com.apple.developer.associated-domains"];
    return configMod;
  });
};
