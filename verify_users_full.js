const http = require("http");

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api/users`;

function fetchUsers(params) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL);
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key])
    );

    console.log(`Requesting: ${url.toString()}`);

    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Request failed with status ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

async function runTests() {
  console.log("Starting User Filter Verification Tests...");
  let passed = true;
  let failures = [];

  const check = (testName, condition, failMsg) => {
    if (!condition) {
      console.error(`❌ ${testName} FAILED: ${failMsg}`);
      failures.push(`${testName}: ${failMsg}`);
      passed = false;
    } else {
      console.log(`✅ ${testName} PASSED`);
    }
  };

  try {
    // 1. Search Filter
    {
      const searchTerm = "Ali"; // Common name
      console.log(`\nTest 1: Search for "${searchTerm}"...`);
      const response = await fetchUsers({ search: searchTerm, limit: 5 });
      const users = response.data.users;

      if (users.length > 0) {
        const allMatch = users.every(
          (u) =>
            (u.fullName && u.fullName.match(new RegExp(searchTerm, "i"))) ||
            (u.email && u.email.match(new RegExp(searchTerm, "i"))) ||
            (u.rollNumber && u.rollNumber.match(new RegExp(searchTerm, "i"))) ||
            (u.cnic && u.cnic.match(new RegExp(searchTerm, "i"))) ||
            (u.mobile && u.mobile.match(new RegExp(searchTerm, "i")))
        );
        check(
          "Search Filter",
          allMatch,
          "Returned users do not match search term"
        );
      } else {
        console.log(
          "⚠️ Search returned no results, cannot verify match accuracy (but might be correct)"
        );
      }
    }

    // 2. Gender Filter
    {
      console.log(`\nTest 2: Gender = male...`);
      const response = await fetchUsers({ gender: "male", limit: 5 });
      const users = response.data.users;
      if (users.length > 0) {
        check(
          "Gender Filter (Male)",
          users.every((u) => u.gender === "male"),
          "Found non-male users"
        );
      }

      console.log(`\nTest 3: Gender = female...`);
      const resFemale = await fetchUsers({ gender: "female", limit: 5 });
      const femaleUsers = resFemale.data.users;
      if (femaleUsers.length > 0) {
        check(
          "Gender Filter (Female)",
          femaleUsers.every((u) => u.gender === "female"),
          "Found non-female users"
        );
      }
    }

    // 3. City Filter
    {
      // First get a city from a user to test with
      const initialDetails = await fetchUsers({ limit: 1 });
      if (initialDetails.data.users.length > 0) {
        const testCity = initialDetails.data.users[0].city;
        console.log(`\nTest 4: City = "${testCity}"...`);
        const response = await fetchUsers({ city: testCity, limit: 5 });
        const users = response.data.users;
        check(
          "City Filter",
          users.every((u) => u.city && u.city.match(new RegExp(testCity, "i"))),
          `Found users not from ${testCity}`
        );
      }
    }

    // 4. Verification Filter
    {
      console.log(`\nTest 5: isVerified = true...`);
      const response = await fetchUsers({ isVerified: "true", limit: 5 });
      const users = response.data.users;
      if (users.length > 0) {
        check(
          "Verified Filter",
          users.every((u) => u.isVerified === true),
          "Found unverified users"
        );
      }

      console.log(`\nTest 6: isVerified = false...`);
      const resUnverified = await fetchUsers({ isVerified: "false", limit: 5 });
      const unverifiedUsers = resUnverified.data.users;
      if (unverifiedUsers.length > 0) {
        check(
          "Unverified Filter",
          unverifiedUsers.every((u) => u.isVerified === false),
          "Found verified users"
        );
      }
    }

    // 5. Challan Filters (Re-verifying briefly)
    {
      console.log(`\nTest 7: Challan Paid = true...`);
      const response = await fetchUsers({ challanPaid: "true", limit: 5 });
      const users = response.data.users;
      if (users.length > 0) {
        const allHavePaid = users.every((u) =>
          u.challans.some((c) => c.paid === true)
        );
        check(
          "Challan Paid Filter",
          allHavePaid,
          "Found users without paid challans"
        );
      }
    }
  } catch (error) {
    console.error("Error running tests:", error);
    passed = false;
    failures.push(`Script Error: ${error.message}`);
  }

  if (passed) {
    console.log("\n✅ ALL USER FILTERS VERIFIED");
    process.exit(0);
  } else {
    console.error("\n❌ USER FILTERS VERIFICATION FAILED");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

runTests();
