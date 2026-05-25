import PropTypes from "prop-types";
import { VectorMap } from "@react-jvectormap/core";
import { worldMerc } from "@react-jvectormap/world";

function SalesByCountryMap({ markers = [] }) {
  return (
    <VectorMap
      map={worldMerc}
      zoomOnScroll={false}
      zoomButtons={false}
      markersSelectable={false}
      backgroundColor="transparent"
      markers={markers}
      regionStyle={{
        initial: {
          fill: "#dee2e7",
          "fill-opacity": 1,
          stroke: "none",
          "stroke-width": 0,
          "stroke-opacity": 0,
        },
      }}
      markerStyle={{
        initial: {
          fill: "#e91e63",
          stroke: "#ffffff",
          "stroke-width": 5,
          "stroke-opacity": 0.5,
          r: 7,
        },
        hover: {
          fill: "E91E63",
          stroke: "#ffffff",
          "stroke-width": 5,
          "stroke-opacity": 0.5,
        },
        selected: {
          fill: "E91E63",
          stroke: "#ffffff",
          "stroke-width": 5,
          "stroke-opacity": 0.5,
        },
      }}
      style={{
        marginTop: "-1.5rem",
      }}
      onRegionTipShow={() => false}
      onMarkerTipShow={() => false}
    />
  );
}

SalesByCountryMap.propTypes = {
  markers: PropTypes.arrayOf(PropTypes.object),
};

export default SalesByCountryMap;
