export const getValuesTable = (operator: "$near" | "$nearSphere") => [
    // Test with positionSchema
    { filter: { [operator]: [0, 0] }, message: 'should validate with valid position', exceptions: {} },
    { filter: { [operator]: [0, 0], $minDistance: 0.1 }, message: 'should validate with valid position and $minDistance', exceptions: {} },
    { filter: { [operator]: [0, 0], $minDistance: -0.1 }, message: 'should invalidate with valid position and negative $minDistance', exceptions: {
        mongodb: { code: 16894, codeName: "Location16894", message: "$minDistance must be non-negative" },
        zod: { code: "too_small", message: 'Too small: expected number to be >0' }
    } },
    { filter: { [operator]: [0, 0], $maxDistance: 0.1 }, message: 'should validate with valid position and $maxDistance', exceptions: {} },
    { filter: { [operator]: [0, 0], $maxDistance: -0.1 }, message: 'should invalidate with valid position and negative $maxDistance', exceptions: {
        mongodb: { code: 16896, codeName: "Location16896", message: "$maxDistance must be non-negative" },
        zod: { code: "too_small", message: 'Too small: expected number to be >0' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] } }, message: 'should validate with valid geometry', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 1 }, message: 'should validate with valid geometry and minDistance', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: 10 }, message: 'should validate with valid geometry and maxDistance', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 1, $maxDistance: 10 }, message: 'should validate with valid geometry, minDistance, and maxDistance', exceptions: {} },
    // Note, we'd expect this to be invalid, but MongoDB doesn't check for this
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 10, $maxDistance: 1 }, message: 'should invalidate with minDistance > maxDistance', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be less than or equal to $maxDistance" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }, message: 'should invalidate with LineString', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Expected geojson geometry with type Point, but got type LineString" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] } }, message: 'should invalidate with Polygon', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Expected geojson geometry with type Point, but got type Polygon" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: `near must be first in: { ${operator}: 123 }` },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "invalid", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: `near must be first in: { ${operator}: "invalid" }` },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: `near must be first in: { ${operator}: true }` },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: `near must be first in: { ${operator}: null }` },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geometry is required for geo near query" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geometry is required for geo near query" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: {} }, message: 'should invalidate with empty geometry object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point" } }, message: 'should invalidate with missing coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [] } }, message: 'should invalidate with empty coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0] } }, message: 'should invalidate with single coordinate', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    // Note, we'd expect this to be invalid, but MongoDB doesn't check for this
    { value: { $geometry: { type: "Point", coordinates: [0, 0, 0] } }, message: 'should invalidate with too many coordinates', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: ["0", "0"] } }, message: 'should invalidate with non-numeric coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: "1" }, message: 'should invalidate with non-numeric minDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be a number" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: "10" }, message: 'should invalidate with non-numeric maxDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$maxDistance must be a number" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: -1 }, message: 'should invalidate with negative minDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be non-negative" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: -1 }, message: 'should invalidate with negative maxDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$maxDistance must be non-negative" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];