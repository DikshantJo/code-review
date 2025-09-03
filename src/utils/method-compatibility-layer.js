/**
 * Method Compatibility Layer for AI Code Review System
 * Provides dynamic method resolution and fallbacks to prevent missing method errors
 * This layer ensures backward compatibility and graceful degradation
 */
class MethodCompatibilityLayer {
  constructor() {
    this.methodMappings = new Map();
    this.fallbackHandlers = new Map();
    this.methodAliases = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the compatibility layer with all known method mappings
   */
  initialize() {
    if (this.initialized) return;

    // QualityGates method mappings
    this.registerMethodMapping('QualityGates', 'setAuditLogger', 'setAuditLogger');
    this.registerMethodMapping('QualityGates', 'evaluateQualityGate', 'evaluateQualityGates');
    this.registerMethodAlias('QualityGates', 'evaluateQualityGate', 'evaluateQualityGates');

    // FileFilter method mappings
    this.registerMethodMapping('FileFilter', 'shouldReviewFile', 'shouldExcludeFile', (result) => !result.shouldExclude);

    // AuditLogger method mappings
    this.registerMethodMapping('AuditLogger', 'logReviewAttempt', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logReviewOutcome', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logAIResponseMetrics', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logWarn', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logError', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logInfo', 'logEvent');
    this.registerMethodMapping('AuditLogger', 'logAIResponse', 'logEvent');

    // LargeCommitHandler method mappings
    this.registerMethodMapping('LargeCommitHandler', 'analyzeCommit', 'analyzeCommitSize');

    // FallbackHandler method mappings
    this.registerMethodMapping('FallbackHandler', 'determineStrategy', 'determineFallbackStrategy');
    this.registerMethodMapping('FallbackHandler', 'executeStrategy', 'executeFallbackStrategy');

    this.initialized = true;
  }

  /**
   * Register a method mapping for dynamic resolution
   * @param {string} className - Name of the class
   * @param {string} methodName - Name of the method being called
   * @param {string} actualMethodName - Name of the actual method to call
   * @param {Function} transformer - Optional function to transform the result
   */
  registerMethodMapping(className, methodName, actualMethodName, transformer = null) {
    const key = `${className}.${methodName}`;
    this.methodMappings.set(key, {
      actualMethod: actualMethodName,
      transformer: transformer
    });
  }

  /**
   * Register a method alias for backward compatibility
   * @param {string} className - Name of the class
   * @param {string} aliasName - Alias method name
   * @param {string} actualMethodName - Name of the actual method
   */
  registerMethodAlias(className, aliasName, actualMethodName) {
    const key = `${className}.${aliasName}`;
    this.methodAliases.set(key, actualMethodName);
  }

  /**
   * Register a fallback handler for when methods don't exist
   * @param {string} className - Name of the class
   * @param {string} methodName - Name of the method
   * @param {Function} fallbackHandler - Fallback function to execute
   */
  registerFallbackHandler(className, methodName, fallbackHandler) {
    const key = `${className}.${methodName}`;
    this.fallbackHandlers.set(key, fallbackHandler);
  }

  /**
   * Dynamically resolve and execute a method call
   * @param {Object} instance - Class instance
   * @param {string} methodName - Method name to call
   * @param {Array} args - Arguments to pass to the method
   * @returns {*} Method result or fallback result
   */
  async executeMethod(instance, methodName, ...args) {
    if (!instance) {
      throw new Error(`Cannot execute method '${methodName}' on undefined instance`);
    }

    const className = instance.constructor.name;
    const key = `${className}.${methodName}`;

    // Check if method exists directly
    if (typeof instance[methodName] === 'function') {
      return await instance[methodName](...args);
    }

    // Check for method mapping
    const mapping = this.methodMappings.get(key);
    if (mapping && typeof instance[mapping.actualMethod] === 'function') {
      const result = await instance[mapping.actualMethod](...args);
      return mapping.transformer ? mapping.transformer(result) : result;
    }

    // Check for method alias
    const alias = this.methodAliases.get(key);
    if (alias && typeof instance[alias] === 'function') {
      return await instance[alias](...args);
    }

    // Check for fallback handler
    const fallbackHandler = this.fallbackHandlers.get(key);
    if (fallbackHandler) {
      return await fallbackHandler(instance, ...args);
    }

    // Default fallback - create a stub method
    return this.createStubMethod(className, methodName, args);
  }

  /**
   * Create a stub method that logs the call and returns a safe default
   * @param {string} className - Name of the class
   * @param {string} methodName - Name of the method
   * @param {Array} args - Arguments that were passed
   * @returns {*} Safe default value
   */
  createStubMethod(className, methodName, args) {
    console.warn(`[MethodCompatibility] Creating stub for ${className}.${methodName} with args:`, args);
    
    // Return appropriate defaults based on method name
    if (methodName.startsWith('log')) {
      return { logged: false, reason: 'stub_method', method: methodName };
    }
    
    if (methodName.startsWith('evaluate') || methodName.startsWith('should')) {
      return false;
    }
    
    if (methodName.startsWith('get') || methodName.startsWith('create')) {
      return null;
    }
    
    if (methodName.startsWith('set')) {
      return true;
    }
    
    return undefined;
  }

  /**
   * Safely call a method with fallback handling
   * @param {Object} instance - Class instance
   * @param {string} methodName - Method name to call
   * @param {Array} args - Arguments to pass to the method
   * @returns {Promise<*>} Method result or fallback result
   */
  async safeCall(instance, methodName, ...args) {
    try {
      return await this.executeMethod(instance, methodName, ...args);
    } catch (error) {
      console.error(`[MethodCompatibility] Error executing ${instance?.constructor?.name}.${methodName}:`, error);
      
      // Return safe defaults for critical methods
      if (methodName.startsWith('log')) {
        return { logged: false, reason: 'execution_error', error: error.message };
      }
      
      if (methodName.startsWith('evaluate')) {
        return { passed: false, reason: 'execution_error', error: error.message };
      }
      
      throw error; // Re-throw for non-critical methods
    }
  }

  /**
   * Check if a method exists on an instance
   * @param {Object} instance - Class instance
   * @param {string} methodName - Method name to check
   * @returns {boolean} Whether the method exists or can be resolved
   */
  hasMethod(instance, methodName) {
    if (!instance) return false;
    
    const className = instance.constructor.name;
    const key = `${className}.${methodName}`;
    
    // Check direct method
    if (typeof instance[methodName] === 'function') return true;
    
    // Check mapping
    const mapping = this.methodMappings.get(key);
    if (mapping && typeof instance[mapping.actualMethod] === 'function') return true;
    
    // Check alias
    const alias = this.methodAliases.get(key);
    if (alias && typeof instance[alias] === 'function') return true;
    
    // Check fallback
    return this.fallbackHandlers.has(key);
  }

  /**
   * Get all available methods for a class instance
   * @param {Object} instance - Class instance
   * @returns {Array} Array of available method names
   */
  getAvailableMethods(instance) {
    if (!instance) return [];
    
    const methods = [];
    const className = instance.constructor.name;
    
    // Get direct methods
    for (const methodName in instance) {
      if (typeof instance[methodName] === 'function') {
        methods.push(methodName);
      }
    }
    
    // Get mapped methods
    for (const [key, mapping] of this.methodMappings) {
      if (key.startsWith(`${className}.`) && typeof instance[mapping.actualMethod] === 'function') {
        const methodName = key.split('.')[1];
        if (!methods.includes(methodName)) {
          methods.push(methodName);
        }
      }
    }
    
    // Get aliased methods
    for (const [key, alias] of this.methodAliases) {
      if (key.startsWith(`${className}.`) && typeof instance[alias] === 'function') {
        const methodName = key.split('.')[1];
        if (!methods.includes(methodName)) {
          methods.push(methodName);
        }
      }
    }
    
    return methods.sort();
  }

  /**
   * Validate that all required methods exist for a class
   * @param {Object} instance - Class instance
   * @param {Array} requiredMethods - Array of required method names
   * @returns {Object} Validation result with missing methods
   */
  validateClass(instance, requiredMethods) {
    const missing = [];
    const available = this.getAvailableMethods(instance);
    
    for (const method of requiredMethods) {
      if (!this.hasMethod(instance, method)) {
        missing.push(method);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing: missing,
      available: available,
      total: available.length
    };
  }

  /**
   * Get compatibility report for all registered classes
   * @returns {Object} Compatibility report
   */
  getCompatibilityReport() {
    const report = {
      totalMappings: this.methodMappings.size,
      totalAliases: this.methodAliases.size,
      totalFallbacks: this.fallbackHandlers.size,
      mappings: Array.from(this.methodMappings.entries()),
      aliases: Array.from(this.methodAliases.entries()),
      fallbacks: Array.from(this.fallbackHandlers.keys())
    };
    
    return report;
  }
}

// Create singleton instance
const methodCompatibilityLayer = new MethodCompatibilityLayer();

module.exports = methodCompatibilityLayer;
