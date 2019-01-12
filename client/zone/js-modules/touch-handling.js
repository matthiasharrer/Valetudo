class EventCache {
    constructor() {
        this.cache = [];
    }

    addPointer(event) {
        this.cache.push({
            pointerId: event.pointerId,
            downPosition: [event.clientX, event.clientY],
            lastPosition: [event.clientX, event.clientY]
        });
    }

    updatePointer(event) {
        const knownPointer = this.cache.find(x => x.pointerId === event.pointerId);
        if(knownPointer) {
            knownPointer.lastPosition = [event.clientX, event.clientY];
        }
    }

    removePointer(pointerId) {
        for (var i = 0; i < this.cache.length; i++) {
            if (this.cache[i].pointerId == pointerId) {
                this.cache.splice(i, 1);
                break;
            }
        }
    }

    getPositions(pointerId) {
        const knownPointer = this.cache.find(x => x.pointerId === pointerId);

        if(!knownPointer) return undefined;

        return {
            downPosition: knownPointer.downPosition,
            lastPosition: knownPointer.lastPosition
        }
    }
}

const tapTolerance = 10;

function distance([x1, y1], [x2, y2]) {
    return Math.sqrt(
        Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
    );
}

export class TouchHandler {
    /**
     * @param {HTMLElement} trackedElement
     */
    constructor(trackedElement) {
        this.trackedElement = trackedElement;
        this.trackedElement.addEventListener("pointerdown", e => this.pointerDown(e));
        this.trackedElement.addEventListener("pointermove", e => this.pointerMove(e));
        this.trackedElement.addEventListener("pointerup", e => this.pointerUp(e));
        this.trackedElement.addEventListener("pointercancel", e => this.pointerCancel(e));
        this.trackedElement.addEventListener("pointerout", e => this.pointerCancel(e));
        this.trackedElement.addEventListener("pointerleave", e => this.pointerCancel(e));

        this.startTouch = null;
        this.lastTouch = null;
        this.isTap = true;

        this.eventCache = new EventCache();
    }

    pointerDown(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        this.eventCache.addPointer(evt);
        this.isTap = true;
    }

    pointerMove(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        const positions = this.eventCache.getPositions(evt.pointerId);

        if(positions) {
            this.eventCache.updatePointer(evt);
            if(this.isTap && distance(positions.downPosition, positions.lastPosition) > tapTolerance) {
                this.isTap = false;

                const panStartEvent = new Event("panstart");
                panStartEvent.coordinates = {x: positions.downPosition[0], y: positions.downPosition[1]};
                this.trackedElement.dispatchEvent(panStartEvent);
            } else if(!this.isTap) {
                const panMoveEvent = new Event("panmove");
                panMoveEvent.startCoordinates = {x: positions.downPosition[0], y: positions.downPosition[1]};
                panMoveEvent.currentCoordinates = {x: evt.clientX, y: evt.clientY};
                this.trackedElement.dispatchEvent(panMoveEvent);
            }
        }
    }

    pointerUp(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        const positions = this.eventCache.getPositions(evt.pointerId);

        if(positions) {
            if(distance(positions.downPosition, [evt.clientX, evt.clientY]) > tapTolerance) {
                this.isTap = false;
            }
            if(this.isTap) {
                const tapEvent = new Event("tap");
                tapEvent.tappedCoordinates = {x: positions.downPosition[0], y: positions.downPosition[1]};
                this.trackedElement.dispatchEvent(tapEvent);
            } else {
                const panEndEvent = new Event("panend");
                panEndEvent.startCoordinates = {x: positions.downPosition[0], y: positions.downPosition[1]};
                panEndEvent.currentCoordinates = {x: evt.clientX, y: evt.clientY};
                this.trackedElement.dispatchEvent(panEndEvent);
            }
            this.eventCache.removePointer(evt.pointerId);
        }
    }

    pointerCancel(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        this.eventCache.removePointer(evt.pointerId);
    }
}