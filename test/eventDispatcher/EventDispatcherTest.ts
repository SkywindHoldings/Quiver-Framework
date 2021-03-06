import {suite, test} from "mocha-typescript";
import {expect} from 'chai';
import {EventDispatcher} from "../../src/eventDispatcher/EventDispatcher";
import {EventListener} from "../../src/eventDispatcher/api/EventListener";
import {CustomEvent} from "./data/CustomEvent";
import {EventGuard} from "../../src/eventDispatcher/api/EventGuard";

/**
 * EventDispatcher test suite
 * @author Kristaps Peļņa
 */
@suite export class EventDispatcherTest {

    private eventDispatcher:EventDispatcher;

    private verifyListenerExistence(eventName:string, callback:EventListener, scope):void {
        expect(
            this.eventDispatcher.hasEventListener(eventName),
            "There is no listener with this event name"
        ).to.be.true;

        expect(
            this.eventDispatcher.hasEventListener(eventName, callback),
            "There is no listener with this callback"
        ).to.be.true;

        expect(
            this.eventDispatcher.hasEventListener(eventName, callback, scope),
            "There is no listener with this scope"
        ).to.be.true;
    }

    before() {
        this.eventDispatcher = new EventDispatcher();
    }

    after() {
        this.eventDispatcher.removeAllEventListeners();
        this.eventDispatcher = null;
    }

    @test("Instantiation")
    instantiation() {
        expect(
            this.eventDispatcher,
            "Event dispatcher instance is not available"
        ).to.be.not.null;

        expect(
            this.eventDispatcher.listenerCount,
            "Event dispatcher instance should not have any listeners on creation"
        ).to.be.eq(0);
    }

    @test("Add listener")
    addListener() {
        const eventName:string = "test";
        const scope:any = this;
        const callback:EventListener = ():void => {
            if (this !== scope) {
                throw new Error("Listener callback scope is not correct");
            }
        };

        this.eventDispatcher.addEventListener(eventName, callback, scope);

        this.verifyListenerExistence(eventName, callback, scope);

        this.eventDispatcher.dispatchEvent(eventName);

        this.verifyListenerExistence(eventName, callback, scope);
    }

    @test("Add listener once")
    addListenerOnce() {
        const eventName:string = "test";
        const scope:any = this;

        let completeCount:number = 0;
        const callback:EventListener = () => {
            completeCount++;
            expect(completeCount, "Callback should be completed only once").lessThan(2);
        };

        this.eventDispatcher.addEventListener(eventName, callback, scope).once();

        this.eventDispatcher.dispatchEvent(eventName);

        expect(
            this.eventDispatcher.hasEventListener(eventName, callback, scope),
            "Listener should be removed after being called once"
        ).be.false;

        this.eventDispatcher.dispatchEvent(eventName);
    }

    @test("Add listener with guards")
    addListenerWithGuards() {
        const eventName:string = "test";
        const callback:EventListener = (event:CustomEvent) => {
            expect(
                event.data.pass,
                "This function should not be called because the guard should have worked"
            ).to.be.true;
        };
        const guard:EventGuard = (event:CustomEvent) => {
            return event.data.pass;
        };

        this.eventDispatcher.addEventListener(eventName, callback).withGuards(guard);

        this.eventDispatcher.dispatchEvent(eventName, {
            pass:true
        });
        this.eventDispatcher.dispatchEvent(eventName, {
            pass:false
        });
    }

    @test("Remove listener")
    removeListener() {
        const eventName:string = "test";
        const scope:any = this;
        const callback:EventListener = () => {
            throw new Error("Callback should not be called if listener has been removed");
        };

        this.eventDispatcher.addEventListener(eventName, callback, scope).once();

        this.eventDispatcher.removeEventListener(eventName, callback, scope);

        this.eventDispatcher.dispatchEvent(eventName);
    }

    @test("Remove all listeners")
    removeAllListeners() {
        const eventName:string = "firstEvent";
        const eventName2:string = "secondEvent";
        const scope:any = this;
        const callback:EventListener = () => {
            throw new Error("Callback should not be called because all listeners have been removed");
        };

        this.eventDispatcher.addEventListener(eventName, callback, scope);
        this.eventDispatcher.addEventListener(eventName2, callback);

        this.eventDispatcher.removeAllEventListeners();

        this.eventDispatcher.dispatchEvent(eventName);
        this.eventDispatcher.dispatchEvent(eventName2);

        expect(
            this.eventDispatcher.listenerCount,
            "Event dispatcher should not have any listeners"
        ).be.eq(0);
    }

    @test("Event dispatch with data")
    eventDispatchWithData() {
        const eventName:string = "test";
        const data:{pass:boolean} = {
            pass:true
        };
        const callback:EventListener = (receivedEvent) => {
            if (receivedEvent.type !== eventName || receivedEvent.data !== data) {
                throw new Error("Data received on event callback does not match dispatched data");
            }
        };

        this.eventDispatcher.addEventListener(eventName, callback);

        this.eventDispatcher.dispatchEvent(eventName, data);
    }

    @test("Custom event dispatch")
    customEventDispatch() {
        const data:{pass:boolean} = {
            pass:true
        };
        const event:CustomEvent = new CustomEvent("test", data);
        const callback:EventListener = (receivedEvent) => {
            if (receivedEvent !== event || receivedEvent.type !== event.type || receivedEvent.data !== data) {
                throw new Error("Data received on event callback does not match dispatched data");
            }
        };

        this.eventDispatcher.addEventListener(event.type, callback);

        this.eventDispatcher.dispatchEvent(event);
    }

    @test("Check invalid dispatch")
    checkInvalidDispatch() {
        const invalidValues:any[] = [undefined, null, ""];

        for (let value of invalidValues) {
            expect(
                () => this.eventDispatcher.dispatchEvent(value),
                "Dispatching invalid values should throw an error. value: " + value
            ).to.throw(Error);
        }
    }

    @test("Check invalid event listeners")
    checkInvalidEventListeners() {
        const invalidValues:any[] = [undefined, null, ""];

        for (let value of invalidValues) {
            expect(
                () => this.eventDispatcher.addEventListener(value, () => {}),
                "Adding a listener to an invalid value should throw an error. value: " + value
            ).to.throw(Error);
            expect(
                () => this.eventDispatcher.removeEventListener(value, () => {}),
                "Removing a listener to an invalid value should throw an error. value: " + value
            ).to.throw(Error);
        }
    }

}