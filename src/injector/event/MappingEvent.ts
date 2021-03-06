import {Event} from "../../eventDispatcher/event/Event";
import {InjectionMapping} from "../data/InjectionMapping";
import {Type} from "../../type/Type";

export class MappingEvent extends Event {

    /**
     * This event is dispatched if an existing mapping is overridden without first unMapping it.
     *
     * The reason for dispatching an event (and tracing a warning) is that in most cases,
     * overriding existing mappings is a sign of bugs in the application. Deliberate mapping
     * changes should be done by first removing the existing mapping.
     * @type {string}
     */
    static readonly MAPPING_OVERRIDE: string = 'mappingOverride';

    /**
     * This event is dispatched when a new mapping is created.
     * @type {string}
     */
    static readonly MAPPING_CREATED: string = 'mappingCreated';

    /**
     * This event is dispatched when a mapping is destroyed.
     * @type {string}
     */
    static readonly MAPPING_DESTROYED: string = 'mappingDestroyed';

    readonly mappedType: Type<any>;
    readonly mapping: InjectionMapping;

    constructor(type:string, mappedType: Type<any>, mapping: InjectionMapping) {
        super(type);
        this.mappedType = mappedType;
        this.mapping = mapping;
    }

}
