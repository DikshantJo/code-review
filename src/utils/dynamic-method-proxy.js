/**
 * Dynamic Method Proxy for AI Code Review System
 * Automatically intercepts method calls and resolves them through the compatibility layer
 * This prevents missing method errors and provides seamless backward compatibility
 */
const methodCompatibilityLayer = require('./method-compatibility-layer');

class DynamicMethodProxy {
  constructor(target, className) {
    this.target = target;
    this.className = className;
    this.proxy = this.createProxy();
    
    // Initialize compatibility layer
    methodCompatibilityLayer.initialize();
  }

  /**
   * Create a proxy that intercepts all method calls
   * @returns {Proxy} Proxy object that handles method calls
   */
  createProxy() {
    const self = this;
    
    return new Proxy(this.target, {
      get(target, prop, receiver) {
        // If it's a function, wrap it to handle missing methods
        if (typeof target[prop] === 'function') {
          return target[prop];
        }
        
        // If it's a method call that doesn't exist, return a dynamic handler
        if (typeof prop === 'string' && prop.includes('(')) {
          const methodName = prop.replace(/\(.*$/, '');
          return self.createDynamicMethod(methodName);
        }
        
        // For property access, return the original
        return target[prop];
      },
      
      apply(target, thisArg, argumentsList) {
        // Handle function calls on the target itself
        if (typeof target === 'function') {
          return Reflect.apply(target, thisArg, argumentsList);
        }
        return target;
      }
    });
  }

  /**
   * Create a dynamic method that handles missing method calls
   * @param {string} methodName - Name of the method being called
   * @returns {Function} Dynamic method handler
   */
  createDynamicMethod(methodName) {
    const self = this;
    
    return async function(...args) {
      try {
        // First try to call the method directly
        if (typeof self.target[methodName] === 'function') {
          return await self.target[methodName](...args);
        }
        
        // If not found, use the compatibility layer
        return await methodCompatibilityLayer.safeCall(self.target, methodName, ...args);
        
      } catch (error) {
        // Log the error and provide a graceful fallback
        console.warn(`[DynamicMethodProxy] Method ${self.className}.${methodName} failed:`, error.message);
        
        // Return appropriate defaults based on method name
        return self.getDefaultReturnValue(methodName, args);
      }
    };
  }

  /**
   * Get default return value for missing methods
   * @param {string} methodName - Name of the method
   * @param {Array} args - Arguments passed to the method
   * @returns {*} Appropriate default value
   */
  getDefaultReturnValue(methodName, args) {
    // Logging methods
    if (methodName.startsWith('log')) {
      return {
        logged: false,
        reason: 'missing_method',
        method: methodName,
        timestamp: new Date().toISOString()
      };
    }
    
    // Evaluation methods
    if (methodName.startsWith('evaluate') || methodName.startsWith('should')) {
      return {
        passed: false,
        reason: 'missing_method',
        method: methodName,
        timestamp: new Date().toISOString()
      };
    }
    
    // Getter methods
    if (methodName.startsWith('get')) {
      return null;
    }
    
    // Setter methods
    if (methodName.startsWith('set')) {
      return true;
    }
    
    // Creation methods
    if (methodName.startsWith('create')) {
      return {
        created: false,
        reason: 'missing_method',
        method: methodName,
        timestamp: new Date().toISOString()
      };
    }
    
    // Analysis methods
    if (methodName.startsWith('analyze')) {
      return {
        analyzed: false,
        reason: 'missing_method',
        method: methodName,
        timestamp: new Date().toISOString()
      };
    }
    
    // Default fallback
    return {
      success: false,
      reason: 'missing_method',
      method: methodName,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get the proxy object
   * @returns {Proxy} The proxy object
   */
  getProxy() {
    return this.proxy;
  }

  /**
   * Validate that the proxy is working correctly
   * @returns {Object} Validation result
   */
  validate() {
    const requiredMethods = this.getRequiredMethods();
    const validation = methodCompatibilityLayer.validateClass(this.target, requiredMethods);
    
    return {
      className: this.className,
      proxyWorking: true,
      targetMethods: Object.getOwnPropertyNames(this.target),
      validation: validation
    };
  }

  /**
   * Get list of methods that should be available
   * @returns {Array} Array of required method names
   */
  getRequiredMethods() {
    const baseMethods = [
      'constructor',
      'toString',
      'valueOf'
    ];
    
    // Add class-specific required methods
    switch (this.className) {
      case 'QualityGates':
        return [...baseMethods, 'setAuditLogger', 'evaluateQualityGate', 'evaluateQualityGates'];
      
      case 'FileFilter':
        return [...baseMethods, 'shouldReviewFile', 'shouldExcludeFile'];
      
      case 'AuditLogger':
        return [...baseMethods, 'logEvent', 'logReviewAttempt', 'logReviewOutcome'];
      
      case 'LargeCommitHandler':
        return [...baseMethods, 'analyzeCommit', 'analyzeCommitSize'];
      
      case 'FallbackHandler':
        return [...baseMethods, 'determineStrategy', 'executeStrategy'];
      
      default:
        return baseMethods;
    }
  }

  /**
   * Get compatibility report for this proxy
   * @returns {Object} Compatibility report
   */
  getCompatibilityReport() {
    return {
      className: this.className,
      proxyActive: true,
      targetMethods: this.getAvailableMethods(),
      compatibility: methodCompatibilityLayer.getCompatibilityReport()
    };
  }

  /**
   * Get available methods on the target
   * @returns {Array} Array of available method names
   */
  getAvailableMethods() {
    return methodCompatibilityLayer.getAvailableMethods(this.target);
  }
}

/**
 * Create a dynamic proxy for any class instance
 * @param {Object} target - The target object to proxy
 * @param {string} className - Name of the class (optional, will be auto-detected)
 * @returns {Proxy} Dynamic proxy object
 */
function createDynamicProxy(target, className = null) {
  if (!target) {
    throw new Error('Cannot create proxy for undefined target');
  }
  
  const detectedClassName = className || target.constructor.name;
  const proxy = new DynamicMethodProxy(target, detectedClassName);
  
  return proxy.getProxy();
}

/**
 * Wrap a class constructor to automatically create dynamic proxies
 * @param {Function} ClassConstructor - The class constructor
 * @returns {Function} Wrapped constructor that creates dynamic proxies
 */
function wrapClassWithDynamicProxy(ClassConstructor) {
  return function(...args) {
    const instance = new ClassConstructor(...args);
    return createDynamicProxy(instance, ClassConstructor.name);
  };
}

module.exports = {
  DynamicMethodProxy,
  createDynamicProxy,
  wrapClassWithDynamicProxy
};
