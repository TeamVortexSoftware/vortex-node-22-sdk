/**
 * Tests for SDK documentation decorators
 */

import {
  VortexMethod,
  VortexPrimary,
  getMethodMetadata,
  getAllMethodMetadata,
  clearMetadata,
} from '../src/decorators';

describe('decorators', () => {
  beforeEach(() => {
    clearMetadata();
  });

  describe('VortexMethod', () => {
    it('should store method metadata', () => {
      class TestClass {
        @VortexMethod({ category: 'authentication', since: '1.0.0' })
        testMethod() {
          return 'test';
        }
      }

      const metadata = getMethodMetadata('testMethod');
      expect(metadata).toBeDefined();
      expect(metadata?.category).toBe('authentication');
      expect(metadata?.since).toBe('1.0.0');
    });

    it('should store deprecated flag', () => {
      class TestClass {
        @VortexMethod({
          category: 'core',
          since: '0.1.0',
          deprecated: true,
          deprecationMessage: 'Use newMethod instead',
        })
        oldMethod() {}
      }

      const metadata = getMethodMetadata('oldMethod');
      expect(metadata?.deprecated).toBe(true);
      expect(metadata?.deprecationMessage).toBe('Use newMethod instead');
    });

    it('should handle multiple decorated methods', () => {
      class TestClass {
        @VortexMethod({ category: 'auth', since: '1.0.0' })
        methodA() {}

        @VortexMethod({ category: 'invitations', since: '1.1.0' })
        methodB() {}

        @VortexMethod({ category: 'webhooks', since: '1.2.0' })
        methodC() {}
      }

      const all = getAllMethodMetadata();
      expect(Object.keys(all)).toHaveLength(3);
      expect(all.methodA.category).toBe('auth');
      expect(all.methodB.category).toBe('invitations');
      expect(all.methodC.category).toBe('webhooks');
    });

    it('should preserve method functionality', () => {
      class TestClass {
        @VortexMethod({ category: 'core', since: '1.0.0' })
        add(a: number, b: number): number {
          return a + b;
        }
      }

      const instance = new TestClass();
      expect(instance.add(2, 3)).toBe(5);
    });
  });

  describe('VortexPrimary', () => {
    it('should mark method as primary', () => {
      class TestClass {
        @VortexPrimary()
        @VortexMethod({ category: 'core', since: '1.0.0' })
        importantMethod() {}
      }

      const metadata = getMethodMetadata('importantMethod');
      expect(metadata?.primary).toBe(true);
    });

    it('should work without VortexMethod decorator', () => {
      class TestClass {
        @VortexPrimary()
        standaloneMethod() {}
      }

      const metadata = getMethodMetadata('standaloneMethod');
      expect(metadata?.primary).toBe(true);
    });
  });

  describe('getAllMethodMetadata', () => {
    it('should return empty object when no decorators used', () => {
      const all = getAllMethodMetadata();
      expect(all).toEqual({});
    });

    it('should return copy to prevent mutation', () => {
      class TestClass {
        @VortexMethod({ category: 'test', since: '1.0.0' })
        method() {}
      }

      const all1 = getAllMethodMetadata();
      all1.method.category = 'mutated';

      const all2 = getAllMethodMetadata();
      expect(all2.method.category).toBe('test');
    });
  });

  describe('clearMetadata', () => {
    it('should remove all stored metadata', () => {
      class TestClass {
        @VortexMethod({ category: 'test', since: '1.0.0' })
        method() {}
      }

      expect(Object.keys(getAllMethodMetadata())).toHaveLength(1);

      clearMetadata();

      expect(Object.keys(getAllMethodMetadata())).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle same method name in different classes', () => {
      class ClassA {
        @VortexMethod({ category: 'classA', since: '1.0.0' })
        sharedName() {}
      }

      class ClassB {
        @VortexMethod({ category: 'classB', since: '2.0.0' })
        sharedName() {}
      }

      // getMethodMetadata returns first match found (iteration order)
      // Both are stored separately by class, getAllMethodMetadata shows last wins
      const all = getAllMethodMetadata();
      // The all object will have one 'sharedName' key - iteration order determines which
      expect(all.sharedName).toBeDefined();
      expect(['classA', 'classB']).toContain(all.sharedName.category);
    });

    it('should handle methods with special characters in name', () => {
      // This tests internal storage, method names are just strings
      class TestClass {
        @VortexMethod({ category: 'test', since: '1.0.0' })
        ['method-with-dash']() {}
      }

      const metadata = getMethodMetadata('method-with-dash');
      expect(metadata?.category).toBe('test');
    });
  });
});
