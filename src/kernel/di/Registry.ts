import { Constructor } from "@/shared/types/Constructor";

export class Registry {
  private static instance: Registry | undefined;
  static getInstance() {
    if (!this.instance) {
      this.instance = new Registry();
    }

    return this.instance;
  }
  private constructor() {}
  private readonly providers = new Map<string, Registry.Provider>();
  register(impl: Constructor, singleton = false) {
    const token = impl.name;

    if (this.providers.has(token)) {
      throw new Error(`"${token}" is already registered in the registry`);
    }

    const deps = Reflect.getMetadata("design:paramtypes", impl) ?? [];

    this.providers.set(token, { impl, deps, singleton });
  }

  resolve<TImpl extends Constructor>(impl: TImpl): InstanceType<TImpl> {
    const token = impl.name;
    const provider = this.providers.get(token);

    if (!provider) {
      throw new Error(`"${token}" is not registered`);
    }
    if (provider.singleton && provider.instance) return provider.instance as InstanceType<TImpl>;
    const deps = provider.deps.map((dep) => this.resolve(dep));
    const instance = new provider.impl(...deps);
    if (provider.singleton) provider.instance = instance;
    return instance;
  }
}

export namespace Registry {
  export type Provider = {
    impl: Constructor;
    deps: Constructor[];
    singleton: boolean;
    instance?: object;
  };
}
