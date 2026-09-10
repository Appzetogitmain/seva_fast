import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";

const libraries = ["places"];
const mapContainerStyle = {
  width: "100%",
  height: "340px",
};

const defaultCenter = {
  lat: 20.5937, // India center
  lng: 78.9629,
};

const ADDRESS_COMPONENT_PRIORITY = {
  locality: [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "locality",
    "administrative_area_level_3",
  ],
  city: [
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ],
  state: ["administrative_area_level_1"],
  pincode: ["postal_code"],
};

const getAddressComponent = (components = [], types = []) => {
  const match = components.find((component) =>
    types.some((type) => component.types?.includes(type)),
  );
  return match?.long_name || "";
};

const extractAddressDetails = (result) => {
  const components = result?.address_components || [];
  const locality =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.locality) || "";
  const city =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.city) || "";
  const state =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.state) || "";
  const pincode =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.pincode) || "";

  return {
    locality,
    city,
    state,
    pincode,
  };
};

const MapPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation = null,
  initialRadius = 5,
  maxRadius = 20,
  preferCurrentLocationOnOpen = false,
}) => {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [marker, setMarker] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const circleRef = useRef(null);
  const searchInputRef = useRef(null);
  const hasUserSelectedLocationRef = useRef(false);
  const locationRequestIdRef = useRef(0);

  useEffect(() => {
    // Google calls this global when the Maps JS API key is invalid, unauthorized
    // for this domain, or the required API isn't enabled/billed. Without this hook
    // the map silently renders a broken, non-interactive fallback (no roads, no
    // click handling) with no visible error in the UI.
    window.gm_authFailure = () => setAuthFailed(true);
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  const clearCircleOverlay = useCallback(() => {
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
  }, []);

  const handleMapLoad = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  useEffect(() => {
    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    if (!isOpen) {
      hasUserSelectedLocationRef.current = false;
      return;
    }

    setRadius(initialRadius);
    locationRequestIdRef.current += 1;
    const reqId = locationRequestIdRef.current;

    // Prioritize previously selected or passed location
    if (initialLocation?.lat && initialLocation?.lng) {
      hasUserSelectedLocationRef.current = true;
      setCenter(initialLocation);
      setMarker(initialLocation);
      if (mapRef.current) {
        mapRef.current.panTo(initialLocation);
        mapRef.current.setZoom(15);
      }
      return;
    }

    if (preferCurrentLocationOnOpen) {
      getCurrentLocation({ silent: true, requestId: reqId });
      return;
    }

    setCenter(defaultCenter);
    setMarker(null);
  }, [isOpen, initialLocation, initialRadius, preferCurrentLocationOnOpen]);

  const onMapClick = useCallback((e) => {
    hasUserSelectedLocationRef.current = true;
    clearCircleOverlay();
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
    setCenter(newPos);
    if (mapRef.current) {
      mapRef.current.panTo(newPos);
    }
  }, [clearCircleOverlay]);

  const onMarkerDragEnd = useCallback((e) => {
    hasUserSelectedLocationRef.current = true;
    clearCircleOverlay();
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
    setCenter(newPos);
    if (mapRef.current) {
      mapRef.current.panTo(newPos);
    }
  }, [clearCircleOverlay]);

  const handlePlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();

    if (place?.geometry?.location) {
      hasUserSelectedLocationRef.current = true;
      clearCircleOverlay();
      const newPos = {
        lat:
          typeof place.geometry.location.lat === "function"
            ? place.geometry.location.lat()
            : place.geometry.location.lat,
        lng:
          typeof place.geometry.location.lng === "function"
            ? place.geometry.location.lng
            : place.geometry.location.lng,
      };
      setCenter(newPos);
      setMarker(newPos);
      setAddress(place.formatted_address || place.name || "");

      if (mapRef.current) {
        if (place.geometry.viewport) {
          mapRef.current.fitBounds(place.geometry.viewport);
        } else {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        }
      }
    } else {
      // Fallback: If user typed text and pressed Enter or place geometry wasn't populated directly
      const inputEl = searchInputRef.current;
      const query = inputEl?.value || address;
      if (query && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { address: query, componentRestrictions: { country: "IN" } },
          (results, status) => {
            if (status === "OK" && results?.[0]?.geometry?.location) {
              hasUserSelectedLocationRef.current = true;
              clearCircleOverlay();
              const loc = results[0].geometry.location;
              const newPos = {
                lat: loc.lat(),
                lng: loc.lng(),
              };
              setCenter(newPos);
              setMarker(newPos);
              setAddress(results[0].formatted_address || query);

              if (mapRef.current) {
                if (results[0].geometry.viewport) {
                  mapRef.current.fitBounds(results[0].geometry.viewport);
                } else {
                  mapRef.current.panTo(newPos);
                  mapRef.current.setZoom(16);
                }
              }
            }
          },
        );
      }
    }
  };

  const getCurrentLocation = ({
    silent = false,
    requestId = null,
    force = false,
  } = {}) => {
    if (force) {
      hasUserSelectedLocationRef.current = false;
      locationRequestIdRef.current += 1;
    }
    const currentReqId = requestId ?? locationRequestIdRef.current;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // If the user already searched or pinned a location, do not overwrite!
          if (!force && hasUserSelectedLocationRef.current) return;
          if (currentReqId !== locationRequestIdRef.current) return;

          clearCircleOverlay();
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(newPos);
          setMarker(newPos);
          if (mapRef.current) {
            mapRef.current.panTo(newPos);
            mapRef.current.setZoom(15);
          }
        },
        () => {
          if (currentReqId !== locationRequestIdRef.current) return;
          if (initialLocation) {
            setCenter(initialLocation);
            setMarker(initialLocation);
            if (mapRef.current) {
              mapRef.current.panTo(initialLocation);
            }
            return;
          }

          if (!silent) {
            alert("Unable to retrieve your location. Please select manually.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
      return;
    }

    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
      if (mapRef.current) {
        mapRef.current.panTo(initialLocation);
      }
      return;
    }

    if (!silent) {
      alert("Unable to retrieve your location. Please select manually.");
    }
  };

  useEffect(() => {
    return () => {
      clearCircleOverlay();
      mapRef.current = null;
    };
  }, [clearCircleOverlay]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) {
      return;
    }

    clearCircleOverlay();

    if (!marker) {
      return;
    }

    circleRef.current = new window.google.maps.Circle({
      map: mapRef.current,
      center: marker,
      radius: radius * 1000,
      fillColor: "var(--primary)",
      fillOpacity: 0.1,
      strokeColor: "var(--primary)",
      strokeOpacity: 0.5,
      strokeWeight: 2,
      clickable: false,
      editable: false,
      zIndex: 1,
    });

    return () => {
      clearCircleOverlay();
    };
  }, [isLoaded, marker, radius, clearCircleOverlay]);

  const handleConfirm = async () => {
    if (!marker) {
      alert("Please select a location on the map.");
      return;
    }

    setIsGeocoding(true);
    try {
      // Reverse geocode only on confirmation to save costs
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: marker }, (results, status) => {
          if (status === "OK") resolve(results[0]);
          else reject(status);
        });
      });

      onConfirm({
        ...marker,
        radius,
        address: result.formatted_address,
        ...extractAddressDetails(result),
      });
      onClose();
    } catch (error) {
      console.error("Geocoding failed:", error);
      // Fallback: confirm without address
      onConfirm({
        ...marker,
        radius,
        address: address || "Custom Location",
      });
      onClose();
    } finally {
      setIsGeocoding(false);
    }
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Select Location">
        <div className="p-8 text-center text-red-500">
          Failed to load Google Maps. Please check your API key and connection.
        </div>
      </Modal>
    );
  }

  if (authFailed) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Select Location">
        <div className="p-8 text-center text-red-500">
          Google Maps rejected the API key for this site. Check that the Maps
          JavaScript API, Places API, and Geocoding API are enabled and billed
          in Google Cloud Console, and that this domain is allowed under the
          key's HTTP referrer restrictions.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Shop Location"
      size="md"
      footer={
        <div className="flex justify-between w-full items-center">
          <div className="text-sm text-gray-500">
            {marker
              ? `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`
              : "No location selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!marker || isGeocoding}>
              {isGeocoding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Location
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isLoaded && (
              <Autocomplete
                onLoad={(ref) => {
                  autocompleteRef.current = ref;
                }}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: "IN" },
                  fields: [
                    "geometry",
                    "formatted_address",
                    "name",
                    "address_components",
                  ],
                }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    data-map-search="true"
                    type="text"
                    placeholder="Search for your shop area..."
                    defaultValue={address}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePlaceChanged();
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </Autocomplete>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => getCurrentLocation({ silent: false, force: true })}
            title="Use current location">
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
          {!isLoaded ? (
            <div className="h-[340px] flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <GoogleMap
              onLoad={handleMapLoad}
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              onClick={onMapClick}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}>
              {marker && (
                <Marker
                  key={`${marker.lat.toFixed(6)}-${marker.lng.toFixed(6)}`}
                  position={marker}
                  draggable={true}
                  onDragEnd={onMarkerDragEnd}
                  animation={window.google.maps.Animation.DROP}
                />
              )}
            </GoogleMap>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              Service Radius (km)
            </label>
            <span className="text-sm font-bold text-primary">{radius} km</span>
          </div>
          <input
            type="range"
            min="1"
            max={maxRadius}
            step="1"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>1 km</span>
            <span>{maxRadius} km</span>
          </div>
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Customers within this radius from your shop will be able to see and
            order from you.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default MapPicker;

