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
      console.log(`Response Status: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        console.error(`Request failed with status ${res.statusCode}`);
        res.resume(); // Consume response data to free up memory
        reject(new Error(`Request failed with status ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error("Failed to parse JSON response");
          reject(e);
        }
      });
    });

    req.on("error", (e) => {
      console.error(`Request error: ${e.message}`);
      reject(e);
    });

    // Set a timeout
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.setTimeout(5000); // 5 seconds timeout
  });
}

async function runTests() {
  console.log("Starting Verification Tests...");
  let passed = true;

  try {
    // Test 1: challanPaid = true
    {
      console.log("\nTest 1: Fetching users with challanPaid=true...");
      const response = await fetchUsers({ challanPaid: "true", limit: 5 });
      const users = response.data.users;
      console.log(`Fetched ${users.length} users.`);

      const invalidUsers = users.filter((u) => {
        // Must have at least one paid challan
        const hasPaid = u.challans.some((c) => c.paid === true);
        return !hasPaid;
      });

      if (invalidUsers.length > 0) {
        console.error(
          "FAILED: Found users without paid challans when filtering for paid:",
          invalidUsers.map((u) => u._id)
        );
        passed = false;
      } else {
        console.log("PASSED");
      }
    }

    // Test 2: challanPaid = false
    {
      console.log("\nTest 2: Fetching users with challanPaid=false...");
      const response = await fetchUsers({ challanPaid: "false", limit: 5 });
      const users = response.data.users;
      console.log(`Fetched ${users.length} users.`);

      const invalidUsers = users.filter((u) => {
        // Should NOT have any paid challan?
        // Based on my logic: hasChallan=true AND hasPaidChallan=false.
        // So they must have challans, but ALL must be unpaid.

        if (u.challans.length === 0) return true; // Should have challans
        const hasPaid = u.challans.some((c) => c.paid === true);
        return hasPaid; // Should not have paid challans
      });

      if (invalidUsers.length > 0) {
        console.error(
          "FAILED: Found users with paid challans or no challans when filtering for unpaid:",
          invalidUsers.map((u) => ({ id: u._id, challans: u.challans }))
        );
        passed = false;
      } else {
        console.log("PASSED");
      }
    }

    // Test 3: noChallan = true
    {
      console.log("\nTest 3: Fetching users with noChallan=true...");
      const response = await fetchUsers({ noChallan: "true", limit: 5 });
      const users = response.data.users;
      console.log(`Fetched ${users.length} users.`);

      const invalidUsers = users.filter((u) => u.challans.length > 0);

      if (invalidUsers.length > 0) {
        console.error(
          "FAILED: Found users WITH challans when filtering for noChallan:",
          invalidUsers.map((u) => u._id)
        );
        passed = false;
      } else {
        console.log("PASSED");
      }
    }

    // Test 4: noChallan = false
    {
      console.log("\nTest 4: Fetching users with noChallan=false...");
      const response = await fetchUsers({ noChallan: "false", limit: 5 });
      const users = response.data.users;
      console.log(`Fetched ${users.length} users.`);

      const invalidUsers = users.filter((u) => u.challans.length === 0);

      if (invalidUsers.length > 0) {
        console.error(
          "FAILED: Found users WITHOUT challans when filtering for hasChallan:",
          invalidUsers.map((u) => u._id)
        );
        passed = false;
      } else {
        console.log("PASSED");
      }
    }
  } catch (error) {
    console.error("Error running tests:", error);
    passed = false;
  }

  if (passed) {
    console.log("\n✅ ALL TESTS PASSED");
    process.exit(0);
  } else {
    console.error("\n❌ TESTS FAILED");
    process.exit(1);
  }
}

runTests();
