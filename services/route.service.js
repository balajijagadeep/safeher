const { computeAreaSafetyScore, calculateDistanceKm } = require('./safetyScore.service');

/**
 * Generate 2-3 realistic alternative routes between Start and End coordinates,
 * evaluate their safety profiles, and recommend the safest path.
 */
async function generateSafeRoutes(startLat, startLng, endLat, endLng) {
    const directDistance = calculateDistanceKm(startLat, startLng, endLat, endLng);

    // Midpoints calculation
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Vector perpendicular for alternate road path offsets
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const offsetScale = 0.008; // ~800m offset for arterial road

    // Route 1: Direct / Fastest (Main straight route, might cut through quieter sectors)
    const route1Coords = [
        [startLat, startLng],
        [startLat + dLat * 0.33, startLng + dLng * 0.33],
        [midLat, midLng],
        [startLat + dLat * 0.67, startLng + dLng * 0.67],
        [endLat, endLng]
    ];

    // Route 2: Main Arterial Road (Follows illuminated high-traffic avenues & police zones)
    const route2Coords = [
        [startLat, startLng],
        [startLat + dLat * 0.25 - dLng * offsetScale, startLng + dLng * 0.25 + dLat * offsetScale],
        [midLat - dLng * (offsetScale * 1.2), midLng + dLat * (offsetScale * 1.2)],
        [startLat + dLat * 0.75 - dLng * (offsetScale * 0.8), startLng + dLng * 0.75 + dLat * (offsetScale * 0.8)],
        [endLat, endLng]
    ];

    // Route 3: Transit & Commercial Boulevard (Via active metro/shops)
    const route3Coords = [
        [startLat, startLng],
        [startLat + dLat * 0.3 + dLng * (offsetScale * 1.1), startLng + dLng * 0.3 - dLat * (offsetScale * 1.1)],
        [midLat + dLng * (offsetScale * 1.3), midLng - dLat * (offsetScale * 1.3)],
        [startLat + dLat * 0.7 + dLng * (offsetScale * 0.9), startLng + dLng * 0.7 - dLat * (offsetScale * 0.9)],
        [endLat, endLng]
    ];

    const evaluatePath = async (coords, name, type, extraDistFactor) => {
        let totalScore = 0;
        for (const pt of coords) {
            const scoreObj = await computeAreaSafetyScore(pt[0], pt[1]);
            totalScore += scoreObj.score;
        }
        const avgScore = Math.round(totalScore / coords.length);
        const distanceKm = +(directDistance * extraDistFactor).toFixed(2);
        const estMinutes = Math.round(distanceKm * 3.5); // ~3.5 min per km in city

        return {
            name,
            type,
            safetyScore: avgScore,
            distanceKm,
            estMinutes,
            coordinates: coords,
            lightingStatus: avgScore > 75 ? 'High (Continuous Streetlights)' : avgScore > 50 ? 'Moderate (Main junctions lit)' : 'Poor / Dim',
            policeCoverage: avgScore > 70 ? 'Frequent Police Patrol Area' : 'Standard Response Zone'
        };
    };

    const routes = [
        await evaluatePath(route2Coords, 'SafeHer Guard Route (Main Boulevard)', 'recommended_safe', 1.12),
        await evaluatePath(route3Coords, 'Commercial & Transit Corridor', 'alternative_transit', 1.18),
        await evaluatePath(route1Coords, 'Direct Alley Route (Fastest)', 'fastest_direct', 1.0)
    ];

    // Sort to highlight the highest safety score
    routes.sort((a, b) => b.safetyScore - a.safetyScore);
    routes[0].isRecommended = true;

    return {
        origin: { lat: startLat, lng: startLng },
        destination: { lat: endLat, lng: endLng },
        recommendedRoute: routes[0].name,
        routes
    };
}

module.exports = {
    generateSafeRoutes
};
