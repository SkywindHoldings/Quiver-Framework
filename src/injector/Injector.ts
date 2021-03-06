import {Type} from "../type/Type";
import {InjectionMapping} from "./data/InjectionMapping";
import {EventDispatcher} from "../eventDispatcher/EventDispatcher";
import {MappingEvent} from "./event/MappingEvent";
import {TypeMetadata} from "../metadata/data/TypeMetadata";
import {metadata} from "../metadata/metadata";
import {ConstructorArg} from "../metadata/data/ConstructorArg";
import {typeReferenceToString} from "../util/StringUtil";
import {PropertyInjection} from "../metadata/data/PropertyInjection";
/**
 * Dependencies provider implementation class
 * @author Jānis Radiņš / Kristaps Peļņa
 */
export class Injector extends EventDispatcher {

    private readonly MASTER_SEAL_KEY:Object = (Math.random() * 0xFFFFFFFF).toString(16);

    private _destroyed:boolean = false;

    private mappings:Map<Type<any>, InjectionMapping> = new Map<Type<any>, InjectionMapping>();

    constructor(parent:Injector = null) {
        super();
        this.parent = parent;
        this.map(Injector).toValue(this).seal();
    }

    //---------------------------
    //  Public properties
    //---------------------------

    /**
     * Parent injector of which to extract mappings that are not present in current injector.
     * @returns {Injector}
     */
    readonly parent:Injector;

    /**
     * Whether Injector is destroyed
     * @returns {boolean}
     */
    get destroyed(): boolean {
        return this._destroyed;
    }

    //---------------------------
    //  Public methods
    //---------------------------

    /**
     * Create a new sub-injector.
     * This injector instance will be the parent instance of the newly created injector.
     * @returns {Injector}
     */
    createSubInjector():Injector {
        return new Injector(this);
    }

    /**
     * Map type to injector.
     * @param type The class type describing the mapping
     * @returns {InjectionMapping}
     * @throws Error in case if method is invoked on destroyed instance
     * @throws Error in case if attempt to override sealed mapping is encountered
     */
    map(type:Type<any>):InjectionMapping {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        if (this.hasDirectMapping(type)) {
            let existingMapping:InjectionMapping = this.getMapping(type);
            if (existingMapping.sealed) {
                throw new Error(`Injector error: sealed mapping of type ${typeReferenceToString(type)} override is attempted!`);
            }

            if (this.hasEventListener(MappingEvent.MAPPING_OVERRIDE)) {
                this.dispatchEvent(new MappingEvent(MappingEvent.MAPPING_OVERRIDE, type, existingMapping));
            }

            this.unMap(type);
        }

        const mapping:InjectionMapping = new InjectionMapping(type, this, this.MASTER_SEAL_KEY);
        this.mappings.set(type, mapping);
        this.dispatchEvent(new MappingEvent(MappingEvent.MAPPING_CREATED, type, mapping));
        return mapping;
    }

    /**
     * Removes the mapping described by the given type from current injector.
     * @param type The class type describing the mapping
     * @throws Error in case if method i invoked on destroyed instance
     * @throws Error if unknown mapping is attempted to be unmapped
     * @throws Error if sealed mapping is attempted to be unmapped
     */
    unMap(type:Type<any>):void {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        if (!this.hasDirectMapping(type)) {
            throw new Error(`Injector error: no mapping could be located for ${typeReferenceToString(type)} as unmap is attempted!`);
        }

        let mapping:InjectionMapping = this.getMapping(type);
        if (mapping.sealed) {
            throw new Error(`Injector error: cannot unmap sealed mapping of type: ${typeReferenceToString(type)}!`);
        }

        //Destroy mapping
        mapping.destroy();
        this.mappings.delete(type);
        this.dispatchEvent(new MappingEvent(MappingEvent.MAPPING_DESTROYED, type, mapping));
    }

    /**
     * Does this injector have a direct mapping for the given type?
     * @param type The type
     * @return True if the mapping exists
     * @throws Error in case if method i invoked on destroyed instance
     */
    hasDirectMapping(type:Type<any>):boolean {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        return this.mappings.has(type);
    }

    /**
     * Does this injector (or any parents) have a mapping for the given type?
     * @param type The type
     * @return True if the mapping exists
     * @throws Error in case if method i invoked on destroyed instance
     */
    hasMapping(type:Type<any>):boolean {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        let injector:Injector = this;
        do {
            //Check if there's direct mapping of requested type
            if (injector.hasDirectMapping(type)) {
                return true;
            }
            //If not move to parent injector
            injector = injector.parent;
        } while (injector);
        return false;
    }

    /**
     * Returns the mapping for the specified dependency class
     * Note that getMapping will only return mappings in exactly this injector, not ones
     * mapped in an ancestor injector. To get mappings from ancestor injectors, query them
     * using parent.
     * This restriction is in place to prevent accidental changing of mappings in ancestor
     * injectors where only the child's response is meant to be altered.
     * @param type The type of the dependency to return the mapping for
     * @return The mapping for the specified dependency class
     * @throws Error in case if method i invoked on destroyed instance
     * @throws Error when no mapping was found for the specified dependency
     */
    getMapping(type:Type<any>):InjectionMapping {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        if (!this.hasDirectMapping(type)) {
            throw new Error(`Injector error: no mapping could be located for ${typeReferenceToString(type)}`);
        }
        return this.mappings.get(type);
    }

    /**
     * Get injected instance mapped by required type.
     * Invoking this method will return existing mapping or create new one in case if there have been no
     * requests for this mapping or it's not mapped with instantiate call.
     * @throws Error in case if method i invoked on destroyed instance
     * @throws Error when no mapping was found for the specified dependency
     */
    get(type:Type<any>):any {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        if (!this.hasMapping(type)) {
            throw new Error(`There are no known mapping for ${typeReferenceToString(type)} type in Injector!`);
        }

        let injector:Injector = this;
        do {
            //Check if there's direct mapping of requested type
            if (injector.hasDirectMapping(type)) {
                return injector.getMapping(type).getInjectedValue();
            }

            //If not move to parent injector
            injector = injector.parent;
        } while (injector);

        throw new Error(`Injection mapping for ${typeReferenceToString(type)} could not be found in this or any of parent injectors and this should not happen!`);
    }

    /**
     * Create instance of given type with constructor argument values injected, if any are described by metadata,
     * and injected properties filled with values from Injector, if there are any.
     * Invoking this method will also invoke any methods marked with @PostConstruct just as injected properties will
     * be filled in.
     * @param type Instance type to be created.
     * @returns {any} Newly created class instance of type described by input argument.
     * @throws Error in case if method i invoked on destroyed instance
     * @throws Error in case if some Injector mapping could not be found.
     */
    instantiateInstance(type:Type<any>):any {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        //There is no metadata for type - simply create instance with no constructor arguments
        if (!metadata.hasMetadata(type)) {
            //Event tho lacking metadata indicates that there is no direct meta mapping for given type, it still
            //might inherit from some class that has
            return this.injectInto(new type());
        }

        const typeMeta:TypeMetadata = metadata.getTypeDescriptor(type);

        //Collect array of constructor arguments, if there are any
        const constructorArgs:any[] = [];
        for (let i:number = 0; i < typeMeta.constructorArguments.length; i++) {
            let argData:ConstructorArg = typeMeta.constructorArguments[i];
            let mappingIsPresent:boolean = this.hasMapping(argData.type);
            if (!mappingIsPresent && !argData.isOptional) {
                throw new Error(`Constructor argument of type: ${typeReferenceToString(argData.type)} for ${typeReferenceToString(type)} could not be found in Injector!`);
            }
            constructorArgs.push(mappingIsPresent ? this.get(argData.type) : undefined);
        }

        //Create new instance with or without injected constructor arguments!
        let instance:any = new type(...constructorArgs);

        //Inject class properties if there are some and return it
        return this.injectInto(instance);
    }

    /**
     * Inspect given type and fill in type properties, clients for Injected values and invoke methods described with
     * @PostConstruct if there are any.
     * @param target The instance to inject into
     * @returns Instance passed in via param with properties filled by injections and post construct methods invoked,
     * or as it where in case if there is no metadata tpo apply.
     * @throws Error in case if method i invoked on destroyed instance
     * @throws Error in case if some Injector mapping could not be found.
     */
    injectInto(target:any):any {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        const inheritedMetadata:TypeMetadata[] = metadata.getInheritedMetadata(target);
        //There are no metadata for given type - do nothing
        if (!inheritedMetadata) {
            return target;
        }

        let propertyInjections:Map<string, PropertyInjection> = new Map<string, PropertyInjection>();
        let postConstructMethods:string[] = [];

        //Join definitions of property injections and post construct methods from all inherited meta
        for (let meta of inheritedMetadata) {
            for(let injection of meta.propertyInjections) {
                if (!propertyInjections.has(injection.name)) {
                    propertyInjections.set(injection.name, injection);
                    //If there are several definitions where one is optional and other not - use it as optional
                } else if (propertyInjections.get(injection.name).isOptional !== injection.isOptional && injection.isOptional) {
                    propertyInjections.set(injection.name, injection);
                }
            }

            for(let method of meta.postConstructMethods) {
                if (postConstructMethods.indexOf(method) === -1) {
                    postConstructMethods.push(method);
                }
            }
        }

        //Fill Injected class properties
        propertyInjections.forEach((injection:PropertyInjection) => {
            let mappingIsPresent:boolean = this.hasMapping(injection.type);
            if (!mappingIsPresent && !injection.isOptional) {
                throw new Error(`Injected property of type: ${typeReferenceToString(injection.type)} for ${typeReferenceToString(target.constructor)} could not be found in Injector!`);
            }
            if (mappingIsPresent) {
                target[injection.name] = this.get(injection.type);
            }
        });

        //Invoke post construct methods, if there are any
        for (let method of postConstructMethods) {
            target[method]();
        }

        return target;

    }

    /**
     * Check if some instance has pre destroy methods defined and if so - invoke them
     * @param target instance of injected values client
     * @throws Error in case if method is invoked on destroyed instance
     */
    destroyInstance(target:any):void {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        const inheritedMetadata:TypeMetadata[] = metadata.getInheritedMetadata(target);
        //There are no metadata for given type - do nothing
        if (!inheritedMetadata) {
            return;
        }

        let preDestroyMethods:string[] = [];

        //Join definitions of pre destroy methods from all inherited meta
        for (let meta of inheritedMetadata) {
            for(let method of meta.preDestroyMethods) {
                if (preDestroyMethods.indexOf(method) === -1) {
                    preDestroyMethods.push(method);
                }
            }
        }

        //Check if there are any pre preDestroyMethods defined for give type and if so invoke them
        for (let method of preDestroyMethods) {
            target[method]();
        }
    }

    /**
     * Destroy injector and all of its direct mappings.
     * @throws Error in case if Injector is already destroyed
     */
    destroy():void {
        if (this._destroyed) {
            throw new Error("Injector instance is already destroyed!");
        }

        //Remove all mappings
        this.mappings.forEach((mapping:InjectionMapping, type:Type<any>) => {
            if (mapping.sealed) {
                mapping.unseal(this.MASTER_SEAL_KEY);
            }
            this.unMap(type);
        });

        this._destroyed = true;
    }
}