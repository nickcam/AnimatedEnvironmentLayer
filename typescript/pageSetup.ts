/// <reference path="../typings/index.d.ts" />

import * as MapView from "esri/views/MapView";
import * as SceneView from "esri/views/SceneView";
import * as Map from "esri/Map";
import * as Point from "esri/geometry/Point";
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Basemap from "esri/Basemap";
import * as on from "dojo/on";
import * as dom from "dojo/dom";
import * as domClass from "dojo/dom-class";

import { AnimatedEnvironmentLayer, DisplayOptions } from "./animatedEnvironmentLayer";

interface DataOption {
    id: string;
    url: string;
    displayOptions: DisplayOptions;
}

export class PageSetup {

    map: Map;
    mapView: MapView;
    sceneView: SceneView;
    activeView: MapView | SceneView;
    environmentLayer: AnimatedEnvironmentLayer;

    private _dataOptions: DataOption[] = [];

    constructor() {
    }

    init() {

        this._initDataOptions();

        let satellite = Basemap.fromId("satellite");
        this.map = new Map({
            basemap: satellite
        });

        this.mapView = new MapView({
            container: "map-view",
            center: new Point({ x: 134, y: -24, spatialReference: new SpatialReference({ wkid: 4326 }) }),
            zoom: 4,
            map: this.map,
            ui: { components: ["compass", "zoom"] }
        });
        this.mapView.ui.move("zoom", "bottom-right");
        this.mapView.ui.move("compass", "bottom-right");

        this.environmentLayer = new AnimatedEnvironmentLayer({
            id: "ael-layer",
            url: this._dataOptions[0].url,
            displayOptions: this._dataOptions[0].displayOptions
        });

        this.map.add(this.environmentLayer);

        //setup some event handlers to react to change of options       
        on(dom.byId("data-select"), "change", (evt) => this._dataChange(evt.target.value));
        on(dom.byId("basemap-select"), "change", (evt) => this._basemapChange(evt.target.value));

        // subscribe to the point-report event and display the values in UI.
        let windLayerAny: any = this.environmentLayer;
        windLayerAny.on("point-report", (rpt) => {
            dom.byId("direction").innerHTML = rpt.direction ? rpt.direction.toFixed(1) : "n/a";
            dom.byId("speed").innerHTML = rpt.speed ? rpt.speed.toFixed(2) : "n/a";
        });
    }

    private _dataChange(id) {
        let opt = undefined;
        for (let i = 0, len = this._dataOptions.length; i < len; i++) {
            if (this._dataOptions[i].id === id) {
                opt = this._dataOptions[i];
                break;
            }
        }
        if (!opt) return;
        this.environmentLayer.displayOptions = opt.displayOptions;
        this.environmentLayer.url = opt.url;
    }

    /**
     * Seed some options for data
     */
    private _initDataOptions() {

        //setup some data options
        let globalWind: DataOption = {
            url: "./data/global-wind.json",
            id: "Global wind",
            displayOptions: {
                maxVelocity: 15
            }
        };

        // change up some display options to make it look different for global wind 2.
        let globalWind2: DataOption = {
            url: "./data/global-wind2.json",
            id: "Global wind 2",
            displayOptions: {
                maxVelocity: 15,
                lineWidth: 8,
                particleAge: 30,
                particleMultiplier: 0.001
            }
        };

        this._dataOptions.push(globalWind);
        this._dataOptions.push(globalWind2);

        let select = dom.byId("data-select");
        this._dataOptions.forEach((opt) => {
            let element = document.createElement("option");
            element.id = opt.id;
            element.innerHTML = opt.id;
            select.appendChild(element);
        });
    }

    private _basemapChange(id) {
        let bm = Basemap.fromId(id);
        this.map.basemap = bm;
    }
}