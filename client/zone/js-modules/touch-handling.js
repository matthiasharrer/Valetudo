class EventCache {
    constructor() {
        this.cache = [];
    }

    addPointer(event) {
        if(this.cache.length === 1) {
            // As this is the pinch start update the down position of the initial pointer to its last position
            this.cache[0].downPosition = this.cache[0].lastPosition;
        } else if(this.cache.length > 1) {
            // Ignore more than two pointers
            return;
        }

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

    getSecondPositions(pointerId) {
        const firstOtherPointer = this.cache.find(x => x.pointerId !== pointerId);

        if(!firstOtherPointer) return undefined;

        return {
            downPosition: firstOtherPointer.downPosition,
            lastPosition: firstOtherPointer.lastPosition
        }
    }
}

const tapTolerance = 5;

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

        const thisPointerpositions = this.eventCache.getPositions(evt.pointerId);
        const secondPointerPositions = this.eventCache.getSecondPositions(evt.pointerId);

        if(thisPointerpositions && secondPointerPositions) {
            this.isTap = false;
            const pinchStartEvent = new Event("pinchstart");
            pinchStartEvent.distance = distance(thisPointerpositions.downPosition, secondPointerPositions.downPosition);
            pinchStartEvent.scale = 1;
            pinchStartEvent.center = {
                x: (thisPointerpositions.downPosition[0] + secondPointerPositions.downPosition[0]) / 2,
                y: (thisPointerpositions.downPosition[1] + secondPointerPositions.downPosition[1]) / 2
            }
            this.trackedElement.dispatchEvent(pinchStartEvent);
        } else {
            this.isTap = true;
        }
    }

    pointerMove(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        const positions = this.eventCache.getPositions(evt.pointerId);
        const secondPointerPositions = this.eventCache.getSecondPositions(evt.pointerId);

        if(positions && !secondPointerPositions) {
            this.panMove(evt, positions);
        } else if(positions && secondPointerPositions) {
            this.pinchMove(evt, positions, secondPointerPositions);
        }
    }

    panMove(evt, positions) {
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

    pinchMove(evt, thisPointerpositions, secondPointerPositions) {
        this.eventCache.updatePointer(evt);
        this.isTap = false;

        const pinchMoveEvent = new Event("pinchmove");
        pinchMoveEvent.distance = distance(thisPointerpositions.lastPosition, secondPointerPositions.lastPosition);
        pinchMoveEvent.scale = pinchMoveEvent.distance / distance(thisPointerpositions.downPosition, secondPointerPositions.downPosition);
        pinchMoveEvent.center = {
            x: (thisPointerpositions.lastPosition[0] + secondPointerPositions.lastPosition[0]) / 2,
            y: (thisPointerpositions.lastPosition[1] + secondPointerPositions.lastPosition[1]) / 2
        }

        this.trackedElement.dispatchEvent(pinchMoveEvent);
    }

    pointerUp(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        const positions = this.eventCache.getPositions(evt.pointerId);
        const secondPointerPositions = this.eventCache.getSecondPositions(evt.pointerId);

        if(positions && secondPointerPositions) {
            this.trackedElement.dispatchEvent(new Event("pinchend"));
            this.eventCache.removePointer(evt.pointerId);
        } else if(positions) {
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

        const positions = this.eventCache.getPositions(evt.pointerId);
        const secondPointerPositions = this.eventCache.getSecondPositions(evt.pointerId);

        if(positions && secondPointerPositions) {
            this.trackedElement.dispatchEvent(new Event("pinchend"));
        }

        this.eventCache.removePointer(evt.pointerId);
    }
}