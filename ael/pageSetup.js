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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3R5cGVzY3JpcHQvcGFnZVNldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhDQUE4Qzs7OztJQW9COUM7UUFVSTtZQUZRLGlCQUFZLEdBQWlCLEVBQUUsQ0FBQztRQUd4QyxDQUFDO1FBRUQsd0JBQUksR0FBSjtZQUFBLGlCQXFDQztZQW5DRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUV4QixJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7Z0JBQ2YsT0FBTyxFQUFFLFNBQVM7YUFDckIsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQztnQkFDdkIsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLE1BQU0sRUFBRSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksZ0JBQWdCLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUM3RixJQUFJLEVBQUUsQ0FBQztnQkFDUCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7Z0JBQ2IsRUFBRSxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2FBQzFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUVoRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxtREFBd0IsQ0FBQztnQkFDakQsRUFBRSxFQUFFLFdBQVc7Z0JBQ2YsR0FBRyxF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TyxrQ0FBYyxHQUF0QixVQUF1QixFQUFFO1lBQ3JCLElBQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFDTCxnQkFBQztJQUFELENBL0hBLEFBK0hDLElBQUE7SUEvSFksOEJBQVMiLCJmaWxlIjoicGFnZVNldHVwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XHJcblxyXG5pbXBvcnQgKiBhcyBNYXBWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL01hcFZpZXdcIjtcclxuaW1wb3J0ICogYXMgU2NlbmVWaWV3IGZyb20gXCJlc3JpL3ZpZXdzL1NjZW5lVmlld1wiO1xyXG5pbXBvcnQgKiBhcyBNYXAgZnJvbSBcImVzcmkvTWFwXCI7XHJcbmltcG9ydCAqIGFzIFBvaW50IGZyb20gXCJlc3JpL2dlb21ldHJ5L1BvaW50XCI7XHJcbmltcG9ydCAqIGFzIFNwYXRpYWxSZWZlcmVuY2UgZnJvbSBcImVzcmkvZ2VvbWV0cnkvU3BhdGlhbFJlZmVyZW5jZVwiO1xyXG5pbXBvcnQgKiBhcyBCYXNlbWFwIGZyb20gXCJlc3JpL0Jhc2VtYXBcIjtcclxuaW1wb3J0ICogYXMgb24gZnJvbSBcImRvam8vb25cIjtcclxuaW1wb3J0ICogYXMgZG9tIGZyb20gXCJkb2pvL2RvbVwiO1xyXG5pbXBvcnQgKiBhcyBkb21DbGFzcyBmcm9tIFwiZG9qby9kb20tY2xhc3NcIjtcclxuXHJcbmltcG9ydCB7IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllciwgRGlzcGxheU9wdGlvbnMsIFBvaW50UmVwb3J0IH0gZnJvbSBcIi4vYW5pbWF0ZWRFbnZpcm9ubWVudExheWVyXCI7XHJcblxyXG5pbnRlcmZhY2UgRGF0YU9wdGlvbiB7XHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgdXJsOiBzdHJpbmc7XHJcbiAgICBkaXNwbGF5T3B0aW9uczogRGlzcGxheU9wdGlvbnM7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQYWdlU2V0dXAge1xyXG5cclxuICAgIG1hcDogTWFwO1xyXG4gICAgbWFwVmlldzogTWFwVmlldztcclxuICAgIHNjZW5lVmlldzogU2NlbmVWaWV3O1xyXG4gICAgYWN0aXZlVmlldzogTWFwVmlldyB8IFNjZW5lVmlldztcclxuICAgIGVudmlyb25tZW50TGF5ZXI6IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllcjtcclxuXHJcbiAgICBwcml2YXRlIF9kYXRhT3B0aW9uczogRGF0YU9wdGlvbltdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdCgpIHtcclxuXHJcbiAgICAgICAgdGhpcy5faW5pdERhdGFPcHRpb25zKCk7XHJcblxyXG4gICAgICAgIGxldCBzYXRlbGxpdGUgPSBCYXNlbWFwLmZyb21JZChcInNhdGVsbGl0ZVwiKTtcclxuICAgICAgICB0aGlzLm1hcCA9IG5ldyBNYXAoe1xyXG4gICAgICAgICAgICBiYXNlbWFwOiBzYXRlbGxpdGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5tYXBWaWV3ID0gbmV3IE1hcFZpZXcoe1xyXG4gICAgICAgICAgICBjb250YWluZXI6IFwibWFwLXZpZXdcIixcclxuICAgICAgICAgICAgY2VudGVyOiBuZXcgUG9pbnQoeyB4OiAxMzQsIHk6IC0yNCwgc3BhdGlhbFJlZmVyZW5jZTogbmV3IFNwYXRpYWxSZWZlcmVuY2UoeyB3a2lkOiA0MzI2IH0pIH0pLFxyXG4gICAgICAgICAgICB6b29tOiA0LFxyXG4gICAgICAgICAgICBtYXA6IHRoaXMubWFwLFxyXG4gICAgICAgICAgICB1aTogeyBjb21wb25lbnRzOiBbXCJjb21wYXNzXCIsIFwiem9vbVwiXSB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5tYXBWaWV3LnVpLm1vdmUoXCJ6b29tXCIsIFwiYm90dG9tLXJpZ2h0XCIpO1xyXG4gICAgICAgIHRoaXMubWFwVmlldy51aS5tb3ZlKFwiY29tcGFzc1wiLCBcImJvdHRvbS1yaWdodFwiKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudExheWVyID0gbmV3IEFuaW1hdGVkRW52aXJvbm1lbnRMYXllcih7XHJcbiAgICAgICAgICAgIGlkOiBcImFlbC1sYXllclwiLFxyXG4gICAgICAgICAgICB1cmw6IHRoaXMuX2RhdGFPcHRpb25zWzBdLnVybCxcclxuICAgICAgICAgICAgZGlzcGxheU9wdGlvbnM6IHRoaXMuX2RhdGFPcHRpb25zWzBdLmRpc3BsYXlPcHRpb25zXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMubWFwLmFkZCh0aGlzLmVudmlyb25tZW50TGF5ZXIpO1xyXG5cclxuICAgICAgICAvL3NldHVwIHNvbWUgZXZlbnQgaGFuZGxlcnMgdG8gcmVhY3QgdG8gY2hhbmdlIG9mIG9wdGlvbnMgICAgICAgXHJcbiAgICAgICAgb24oZG9tLmJ5SWQoXCJkYXRhLXNlbGVjdFwiKSwgXCJjaGFuZ2VcIiwgKGV2dCkgPT4gdGhpcy5fZGF0YUNoYW5nZShldnQudGFyZ2V0LnZhbHVlKSk7XHJcbiAgICAgICAgb24oZG9tLmJ5SWQoXCJiYXNlbWFwLXNlbGVjdFwiKSwgXCJjaGFuZ2VcIiwgKGV2dCkgPT4gdGhpcy5fYmFzZW1hcENoYW5nZShldnQudGFyZ2V0LnZhbHVlKSk7XHJcblxyXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byB0aGUgcG9pbnQtcmVwb3J0IGV2ZW50IGFuZCBkaXNwbGF5IHRoZSB2YWx1ZXMgaW4gVUkuXHJcbiAgICAgICAgbGV0IHdpbmRMYXllckFueTogYW55ID0gdGhpcy5lbnZpcm9ubWVudExheWVyO1xyXG4gICAgICAgIHdpbmRMYXllckFueS5vbihcInBvaW50LXJlcG9ydFwiLCAocnB0OiBQb2ludFJlcG9ydCkgPT4ge1xyXG4gICAgICAgICAgICBkb20uYnlJZChcImRpcmVjdGlvblwiKS5pbm5lckhUTUwgPSBycHQuZGVncmVlID8gcnB0LmRlZ3JlZS50b0ZpeGVkKDEpIDogXCJuL2FcIjtcclxuICAgICAgICAgICAgZG9tLmJ5SWQoXCJzcGVlZFwiKS5pbm5lckhUTUwgPSBycHQudmVsb2NpdHkgPyBycHQudmVsb2NpdHkudG9GaXhlZCgyKSA6IFwibi9hXCI7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZGF0YUNoYW5nZShpZCkge1xyXG4gICAgICAgIGxldCBvcHQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2RhdGFPcHRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9kYXRhT3B0aW9uc1tpXS5pZCA9PT0gaWQpIHtcclxuICAgICAgICAgICAgICAgIG9wdCA9IHRoaXMuX2RhdGFPcHRpb25zW2ldO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFvcHQpIHJldHVybjtcclxuICAgICAgICB0aGlzLmVudmlyb25tZW50TGF5ZXIuZGlzcGxheU9wdGlvbnMgPSBvcHQuZGlzcGxheU9wdGlvbnM7XHJcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudExheWVyLnVybCA9IG9wdC51cmw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZWVkIHNvbWUgb3B0aW9ucyBmb3IgZGF0YVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9pbml0RGF0YU9wdGlvbnMoKSB7XHJcblxyXG4gICAgICAgIC8vIHNldHVwIHNvbWUgZGF0YSBvcHRpb25zXHJcbiAgICAgICAgbGV0IGdsb2JhbFdpbmQ6IERhdGFPcHRpb24gPSB7XHJcbiAgICAgICAgICAgIHVybDogXCIuL2RhdGEvZ2xvYmFsLXdpbmQuanNvblwiLFxyXG4gICAgICAgICAgICBpZDogXCJHbG9iYWwgd2luZFwiLFxyXG4gICAgICAgICAgICBkaXNwbGF5T3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgbWF4VmVsb2NpdHk6IDE1LFxyXG4gICAgICAgICAgICAgICAgLy8gbWFrZSB0aGUgcGFydGljbGUgbXVsdGlwbGllcnMgY2hhbmdlIGRlcGVuZGluZyBvbiB6b29tIGxldmVsXHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU11bHRpcGxpZXJCeVpvb206IHtcclxuICAgICAgICAgICAgICAgICAgICBkaWZmUmF0aW86IDAuNCxcclxuICAgICAgICAgICAgICAgICAgICBtYXhNdWx0aXBsaWVyOiA1LFxyXG4gICAgICAgICAgICAgICAgICAgIG1pbk11bHRpcGxpZXI6IDAuMixcclxuICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZU11bHRpcGxpZXI6IDQsXHJcbiAgICAgICAgICAgICAgICAgICAgem9vbUxldmVsOiA0XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gTWFrZSBzd2VsbCBsb29rIGRpZmZlcmVudCB0byB3aW5kXHJcbiAgICAgICAgbGV0IGF1c1N3ZWxsOiBEYXRhT3B0aW9uID0ge1xyXG4gICAgICAgICAgICB1cmw6IFwiLi9kYXRhL2F1c3dhdmVfcG9wX2ZsZHNfY29tYmluZWQuanNvblwiLFxyXG4gICAgICAgICAgICBpZDogXCJBdXN0cmFsaWFuIHN3ZWxsXCIsXHJcbiAgICAgICAgICAgIGRpc3BsYXlPcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhWZWxvY2l0eTogNSxcclxuICAgICAgICAgICAgICAgIGxpbmVXaWR0aDogMTAsXHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZUFnZTogMzAsXHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU11bHRpcGxpZXI6IDEsXHJcbiAgICAgICAgICAgICAgICBjb2xvclNjYWxlOiBbXCIjZmZmZmZmXCIsIFwiI2U5ZWNmYlwiLCBcIiNkM2Q5ZjdcIiwgXCIjYmRjNmYzXCIsIFwiI2E3YjNlZlwiLCBcIiM5MWEwZWJcIiwgXCIjN2I4ZGU3XCIsIFwiIzY1N2FlM1wiLCBcIiM0ZjY3ZGZcIiwgXCIjMzk1NGRiXCJdXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBjaGFuZ2UgdXAgc29tZSBkaXNwbGF5IG9wdGlvbnMgdG8gbWFrZSBpdCBsb29rIGRpZmZlcmVudCBmb3IgZ2xvYmFsIHdpbmQgMi5cclxuICAgICAgICBsZXQgZ2xvYmFsV2luZDI6IERhdGFPcHRpb24gPSB7XHJcbiAgICAgICAgICAgIHVybDogXCIuL2RhdGEvZ2xvYmFsLXdpbmQyLmpzb25cIixcclxuICAgICAgICAgICAgaWQ6IFwiR2xvYmFsIHdpbmQgMlwiLFxyXG4gICAgICAgICAgICBkaXNwbGF5T3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgbWF4VmVsb2NpdHk6IDE1LFxyXG4gICAgICAgICAgICAgICAgcGFydGljbGVNdWx0aXBsaWVyOiAzXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5wdXNoKGdsb2JhbFdpbmQpO1xyXG4gICAgICAgIHRoaXMuX2RhdGFPcHRpb25zLnB1c2goYXVzU3dlbGwpO1xyXG4gICAgICAgIHRoaXMuX2RhdGFPcHRpb25zLnB1c2goZ2xvYmFsV2luZDIpO1xyXG5cclxuICAgICAgICBsZXQgc2VsZWN0ID0gZG9tLmJ5SWQoXCJkYXRhLXNlbGVjdFwiKTtcclxuICAgICAgICB0aGlzLl9kYXRhT3B0aW9ucy5mb3JFYWNoKChvcHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpO1xyXG4gICAgICAgICAgICBlbGVtZW50LmlkID0gb3B0LmlkO1xyXG4gICAgICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9IG9wdC5pZDtcclxuICAgICAgICAgICAgc2VsZWN0LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2Jhc2VtYXBDaGFuZ2UoaWQpIHtcclxuICAgICAgICBsZXQgYm0gPSBCYXNlbWFwLmZyb21JZChpZCk7XHJcbiAgICAgICAgdGhpcy5tYXAuYmFzZW1hcCA9IGJtO1xyXG4gICAgfVxyXG59Il19
