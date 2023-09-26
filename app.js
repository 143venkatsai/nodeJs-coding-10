const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`Db Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Convert State Snake Case to Camel Case

const convertStateSnakeCaseToCamelCase = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//Convert District Snake Case to Camel Case

const convertDistrictSnakeCaseToCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//Convert State Report to Statistic Data

const getStatisticDataOfState = (dbObject) => {
  return {
    totalCases: dbObject.cases,
    totalCured: dbObject.cured,
    totalActive: dbObject.active,
    totalDeaths: dbObject.deaths,
  };
};

//Middleware Function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "bhdgfhwebyghfbeeufe", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login User API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "bhdgfhwebyghfbeeufe");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get States API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const stateQuery = await db.all(getStatesQuery);
  response.send(
    stateQuery.map((eachState) => convertStateSnakeCaseToCamelCase(eachState))
  );
});

//Get State API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  response.send(convertStateSnakeCaseToCamelCase(getState));
});

//Add District API 4

app.post("/districts/", authenticateToken, (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO 
      district(district_name, state_id, cases, cured, active, deaths)
    VALUES
      ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const createDistrict = db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

//Get District PAI 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send(convertDistrictSnakeCaseToCamelCase(getDistrict));
  }
);

//Delete District API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    const deleteDistrict = db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update District API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE 
      district 
    SET 
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths};`;
    const updateDistrict = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//Get State Statistics API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateReport = `
    SELECT
      SUM(cases) AS cases,
      SUM(cured) AS cured,
      SUM(active) AS active,
      SUM(deaths) AS deaths
    FROM 
      district
    WHERE 
      state_id = ${stateId};`;
    const getStatData = await db.get(getStateReport);
    response.send(getStatisticDataOfState(getStatData));
  }
);

module.exports = app;
