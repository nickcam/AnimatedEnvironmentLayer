/// <reference path="../typings/index.d.ts" />
define(["require", "exports", "esri/views/MapView", "esri/Map", "esri/geometry/Point", "esri/geometry/SpatialReference", "esri/Basemap", "dojo/on", "dojo/dom", "./animatedEnvironmentLayer"], function (require, exports, MapView, Map, Point, SpatialReference, Basemap, on, dom, animatedEnvironmentLayer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var PageSetup = (function () {
        function PageSetup() {
            this._dataOptions = [];
        }
        PageSetup.prototype.init = function () {
            var _this = this;
            this._initDataOptions();
            var satellite = Basemap.fromId("satellite");
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
            this.environmentLayer = new animatedEnvironmentLayer_1.AnimatedEnvironmentLayer({
                id: "ael-layer",
                url: this._dataOptions[0].url,
                displayOptions: this._dataOptions[0].displayOptions
            });
            this.map.add(this.environmentLayer);
            //setup some event handlers to react to change of options       
            on(dom.byId("data-select"), "change", function (evt) { return _this._dataChange(evt.target.value); });
            on(dom.byId("basemap-select"), "change", function (evt) { return _this._basemapChange(evt.target.value); });
            // subscribe to the point-report event and display the values in UI.
            var windLayerAny = this.environmentLayer;
            windLayerAny.on("point-report", function (rpt) {
                dom.byId("direction").innerHTML = rpt.degree ? rpt.degree.toFixed(1) : "n/a";
                dom.byId("speed").innerHTML = rpt.velocity ? rpt.velocity.toFixed(2) : "n/a";
            });
        };
        PageSetup.prototype._dataChange = function (id) {
            var opt = undefined;
            for (var i = 0, len = this._dataOptions.length; i < len; i++) {
                if (this._dataOptions[i].id === id) {
                    opt = this._dataOptions[i];
                    break;
                }
            }
            if (!opt)
                return;
            this.environmentLayer.displayOptions = opt.displayOptions;
            this.environmentLayer.url = opt.url;
        };
        /**
         * Seed some options for data
         */
        PageSetup.prototype._initDataOptions = function () {
            // setup some data options
            var globalWind = {
                url: "./data/global-wind.json",
                id: "Global wind",
                displayOptions: {
                    maxVelocity: 15,
                    // make the particle multipliers change depending on zoom level
                    particleMultiplierByZoom: {
                        diffRatio: 0.4,
                        maxMultiplier: 5,
                        minMultiplier: 0.2,
                        particleMultiplier: 4,
                        zoomLevel: 4
                    }
                }
            };
            // Make swell look different to wind
            var ausSwell = {
                url: "./data/auswave_pop_flds_combined.json",
                id: "Australian swell",
                displayOptions: {
                    maxVelocity: 5,
                    lineWidth: 10,
                    particleAge: 30,
                    particleMultiplier: 1,
                    colorScale: ["#ffffff", "#e9ecfb", "#d3d9f7", "#bdc6f3", "#a7b3ef", "#91a0eb", "#7b8de7", "#657ae3", "#4f67df", "#3954db"]
                }
            };
            // change up some display options to make it look different for global wind 2.
            var globalWind2 = {
                url: "./data/global-wind2.json",
                id: "Global wind 2",
                displayOptions: {
                    maxVelocity: 15,
                    particleMultiplier: 3
                }
            };
            this._dataOptions.push(globalWind);
            this._dataOptions.push(ausSwell);
            this._dataOptions.push(globalWind2);
            var select = dom.byId("data-select");
            this._dataOptions.forEach(function (opt) {
                var element = document.createElement("option");
                element.id = opt.id;
                element.innerHTML = opt.id;
                select.appendChild(element);
            });
        };
        PageSetup.prototype._basemapChange = function (id) {
            var bm = Basemap.fromId(id);
            this.map.basemap = bm;
        };
        return PageSetup;
    }());
    exports.PageSetup = PageSetup;
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvcGFnZVNldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7OztJQW9COUM7UUFVSTtZQUZRLGlCQUFZLEdBQWlCLEVBQUUsQ0FBQztRQUd4QyxDQUFDO1FBRUQsd0JBQUksR0FBSjtZQUFBLGlCQXFDQztZQW5DRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUV4QixJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7Z0JBQ2YsT0FBTyxFQUFFLFNBQVM7YUFDckIsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDdkIsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUM3RixJQUFJLEVBQUUsQ0FBQztnQkFDUCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7Z0JBQ2IsRUFBRSxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2FBQzFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUVoRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxtREFBd0IsQ0FBQztnQkFDakQsRUFBRSxFQUFFLFdBQVc7Z0JBQ2YsR0FBRyxF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TyxrQ0FBYyxHQUF0QixVQUF1QixFQUFFO1lBQ3JCLElBQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFDTCxnQkFBQztJQUFELENBL0hBLEFBK0hDLElBQUE7SUEvSFksOEJBQVMiLCJmaWxlIjoicGFnZVNldHVwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XHJcblxyXG5pbXBvcnQgKiBhcyBNYXBWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL01hcFZpZXdcIjtcclxuaW1wb3J0ICogYXMgU2NlbmVWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL1NjZW5lVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBNYXAgZnJvbSBcImVzcmkvTWFwXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBCYXNlbWFwIGZyb20gXCJlc3JpL0Jhc2VtYXBcIjtcclxuaW1wb3J0ICogYXMgb24gZnJvbSBcImRvam8vb25cIjtcclxuaW1wb3J0ICogYXMgZG9tIGZyb20gXCJkb2pvL2RvbVwiO1xyXG5pbXBvcnQgKiBhcyBkb21DbGFzcyBmcm9tIFwiZG9qby9kb20tY2xhc3NcIjtcclxuXHJcbmltcG9ydCB7IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllciwgRGlzcGxheU9wdGlvbnMsIFBvaW50UmVwb3J0IH0gZnJvbSBcIi4vYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyXCI7XHJcblxyXG5pbnRlcmZhY2UgRGF0YU9wdGlvbiB7XHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgdXJsOiBzdHJpbmc7XHJcbiAgICBkaXNwbGF5T3B0aW9uczogRGlzcGxheU9wdGlvbnM7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQYWdlU2V0dXAge1xyXG5cclxuICAgIG1hcDogTWFwO1xyXG4gICAgbWFwVmlldzogTWFwVmlldztcclxuICAgIHNjZW5lVmlldzogU2NlbmVWaWV3O1xyXG4gICAgYWN0aXZlVmlldzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIGVudmlyb25tZW50TGF5ZXI6IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllcjtcclxuXHJcbiAgICBwcml2YXRlIF9kYXRhT3B0aW9uczogRGF0YU9wdGlvbltdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuXHJcbiAgICAgICAgdGhpcy5faW5pdERhdGFPcHRpb25zKCk7XHJcblxyXG4gICAgICAgIGxldCBzYXRlbGxpdGUgPSBCYXNlbWFwLmZyb21JZChcInNhdGVsbGl0ZVwiKTtcclxuICAgICAgICB0aGlzLm1hcCA9IG5ldyBNYXAoe1xyXG4gICAgICAgICAgICBiYXNlbWFwOiBzYXRlbGxpdGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5tYXBWaWV3ID0gbmV3IE1hcFZpZXcoeyBcclxuICAgICAgICAgICAgY29udGFpbmVyOiBcIm1hcC12aWV3XCIsXHJcbiAgICAgICAgICAgIGNlbnRlcjogbmV3IFBvaW50KHsgeDogMTM0LCB5OiAtMjQsIHNwYXRpYWxSZWZlcmVuY2U6IG5ldyBTcGF0aWFsUmVmZXJlbmNlKHsgd2tpZDogNDMyNiB9KSB9KSxcclxuICAgICAgICAgICAgem9vbTogNCxcclxuICAgICAgICAgICAgbWFwOiB0aGlzLm1hcCxcclxuICAgICAgICAgICAgdWk6IHsgY29tcG9uZW50czogW1wiY29tcGFzc1wiLCBcInpvb21cIl0gfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMubWFwVmlldy51aS5tb3ZlKFwiem9vbVwiLCBcImJvdHRvbS1yaWdodFwiKTtcclxuICAgICAgICB0aGlzLm1hcFZpZXcudWkubW92ZShcImNvbXBhc3NcIiwgXCJib3R0b20tcmlnaHRcIik7XHJcblxyXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnRMYXllciA9IG5ldyBBbmltYXRlZEVudmlyb25tZW50TGF5ZXIoe1xyXG4gICAgICAgICAgICBpZDogXCJhZWwtbGF5ZXJcIixcclxuICAgICAgICAgICAgdXJsOiB0aGlzLl9kYXRhT3B0aW9uc1swXS51cmwsXHJcbiAgICAgICAgICAgIGRpc3BsYXlPcHRpb25zOiB0aGlzLl9kYXRhT3B0aW9uc1swXS5kaXNwbGF5T3B0aW9uc1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLm1hcC5hZGQodGhpcy5lbnZpcm9ubWVudExheWVyKTtcclxuXHJcbiAgICAgICAgLy9zZXR1cCBzb21lIGV2ZW50IGhhbmRsZXJzIHRvIHJlYWN0IHRvIGNoYW5nZSBvZiBvcHRpb25zICAgICAgIFxyXG4gICAgICAgIG9uKGRvbS5ieUlkKFwiZGF0YS1zZWxlY3RcIiksIFwiY2hhbmdlXCIsIChldnQpID0+IHRoaXMuX2RhdGFDaGFuZ2UoZXZ0LnRhcmdldC52YWx1ZSkpO1xyXG4gICAgICAgIG9uKGRvbS5ieUlkKFwiYmFzZW1hcC1zZWxlY3RcIiksIFwiY2hhbmdlXCIsIChldnQpID0+IHRoaXMuX2Jhc2VtYXBDaGFuZ2UoZXZ0LnRhcmdldC52YWx1ZSkpO1xyXG5cclxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gdGhlIHBvaW50LXJlcG9ydCBldmVudCBhbmQgZGlzcGxheSB0aGUgdmFsdWVzIGluIFVJLlxyXG4gICAgICAgIGxldCB3aW5kTGF5ZXJBbnk6IGFueSA9IHRoaXMuZW52aXJvbm1lbnRMYXllcjtcclxuICAgICAgICB3aW5kTGF5ZXJBbnkub24oXCJwb2ludC1yZXBvcnRcIiwgKHJwdDogUG9pbnRSZXBvcnQpID0+IHtcclxuICAgICAgICAgICAgZG9tLmJ5SWQoXCJkaXJlY3Rpb25cIikuaW5uZXJIVE1MID0gcnB0LmRlZ3JlZSA/IHJwdC5kZWdyZWUudG9GaXhlZCgxKSA6IFwibi9hXCI7XHJcbiAgICAgICAgICAgIGRvbS5ieUlkKFwic3BlZWRcIikuaW5uZXJIVE1MID0gcnB0LnZlbG9jaXR5ID8gcnB0LnZlbG9jaXR5LnRvRml4ZWQoMikgOiBcIm4vYVwiO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RhdGFDaGFuZ2UoaWQpIHtcclxuICAgICAgICBsZXQgb3B0ID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9kYXRhT3B0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZGF0YU9wdGlvbnNbaV0uaWQgPT09IGlkKSB7XHJcbiAgICAgICAgICAgICAgICBvcHQgPSB0aGlzLl9kYXRhT3B0aW9uc1tpXTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghb3B0KSByZXR1cm47XHJcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudExheWVyLmRpc3BsYXlPcHRpb25zID0gb3B0LmRpc3BsYXlPcHRpb25zO1xyXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnRMYXllci51cmwgPSBvcHQudXJsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VlZCBzb21lIG9wdGlvbnMgZm9yIGRhdGFcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfaW5pdERhdGFPcHRpb25zKCkge1xyXG5cclxuICAgICAgICAvLyBzZXR1cCBzb21lIGRhdGEgb3B0aW9uc1xyXG4gICAgICAgIGxldCBnbG9iYWxXaW5kOiBEYXRhT3B0aW9uID0ge1xyXG4gICAgICAgICAgICB1cmw6IFwiLi9kYXRhL2dsb2JhbC13aW5kLmpzb25cIixcclxuICAgICAgICAgICAgaWQ6IFwiR2xvYmFsIHdpbmRcIixcclxuICAgICAgICAgICAgZGlzcGxheU9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIG1heFZlbG9jaXR5OiAxNSxcclxuICAgICAgICAgICAgICAgIC8vIG1ha2UgdGhlIHBhcnRpY2xlIG11bHRpcGxpZXJzIGNoYW5nZSBkZXBlbmRpbmcgb24gem9vbSBsZXZlbFxyXG4gICAgICAgICAgICAgICAgcGFydGljbGVNdWx0aXBsaWVyQnlab29tOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGlmZlJhdGlvOiAwLjQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWF4TXVsdGlwbGllcjogNSxcclxuICAgICAgICAgICAgICAgICAgICBtaW5NdWx0aXBsaWVyOiAwLjIsXHJcbiAgICAgICAgICAgICAgICAgICAgcGFydGljbGVNdWx0aXBsaWVyOiA0LFxyXG4gICAgICAgICAgICAgICAgICAgIHpvb21MZXZlbDogNFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIE1ha2Ugc3dlbGwgbG9vayBkaWZmZXJlbnQgdG8gd2luZFxyXG4gICAgICAgIGxldCBhdXNTd2VsbDogRGF0YU9wdGlvbiA9IHtcclxuICAgICAgICAgICAgdXJsOiBcIi4vZGF0YS9hdXN3YXZlX3BvcF9mbGRzX2NvbWJpbmVkLmpzb25cIixcclxuICAgICAgICAgICAgaWQ6IFwiQXVzdHJhbGlhbiBzd2VsbFwiLFxyXG4gICAgICAgICAgICBkaXNwbGF5T3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgbWF4VmVsb2NpdHk6IDUsXHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IDEwLFxyXG4gICAgICAgICAgICAgICAgcGFydGljbGVBZ2U6IDMwLFxyXG4gICAgICAgICAgICAgICAgcGFydGljbGVNdWx0aXBsaWVyOiAxLFxyXG4gICAgICAgICAgICAgICAgY29sb3JTY2FsZTogW1wiI2ZmZmZmZlwiLCBcIiNlOWVjZmJcIiwgXCIjZDNkOWY3XCIsIFwiI2JkYzZmM1wiLCBcIiNhN2IzZWZcIiwgXCIjOTFhMGViXCIsIFwiIzdiOGRlN1wiLCBcIiM2NTdhZTNcIiwgXCIjNGY2N2RmXCIsIFwiIzM5NTRkYlwiXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gY2hhbmdlIHVwIHNvbWUgZGlzcGxheSBvcHRpb25zIHRvIG1ha2UgaXQgbG9vayBkaWZmZXJlbnQgZm9yIGdsb2JhbCB3aW5kIDIuXHJcbiAgICAgICAgbGV0IGdsb2JhbFdpbmQyOiBEYXRhT3B0aW9uID0ge1xyXG4gICAgICAgICAgICB1cmw6IFwiLi9kYXRhL2dsb2JhbC13aW5kMi5qc29uXCIsXHJcbiAgICAgICAgICAgIGlkOiBcIkdsb2JhbCB3aW5kIDJcIixcclxuICAgICAgICAgICAgZGlzcGxheU9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIG1heFZlbG9jaXR5OiAxNSxcclxuICAgICAgICAgICAgICAgIHBhcnRpY2xlTXVsdGlwbGllcjogM1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5fZGF0YU9wdGlvbnMucHVzaChnbG9iYWxXaW5kKTtcclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5wdXNoKGF1c1N3ZWxsKTtcclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5wdXNoKGdsb2JhbFdpbmQyKTtcclxuXHJcbiAgICAgICAgbGV0IHNlbGVjdCA9IGRvbS5ieUlkKFwiZGF0YS1zZWxlY3RcIik7XHJcbiAgICAgICAgdGhpcy5fZGF0YU9wdGlvbnMuZm9yRWFjaCgob3B0KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIm9wdGlvblwiKTtcclxuICAgICAgICAgICAgZWxlbWVudC5pZCA9IG9wdC5pZDtcclxuICAgICAgICAgICAgZWxlbWVudC5pbm5lckhUTUwgPSBvcHQuaWQ7XHJcbiAgICAgICAgICAgIHNlbGVjdC5hcHBlbmRDaGlsZChlbGVtZW50KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9iYXNlbWFwQ2hhbmdlKGlkKSB7XHJcbiAgICAgICAgbGV0IGJtID0gQmFzZW1hcC5mcm9tSWQoaWQpO1xyXG4gICAgICAgIHRoaXMubWFwLmJhc2VtYXAgPSBibTtcclxuICAgIH1cclxufSJdfQ==
