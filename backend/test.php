<?php
// Database connection settings remain the same
$servername = "localhost";  
$username = "root";         
$password = "";             
$dbname = "nigerian_constitution"; 

// Create a new MySQL connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$jsonFile = 'constitution.json'; 
$jsonData = file_get_contents($jsonFile);
$data = json_decode($jsonData, true);

// Check if JSON is loaded correctly
if (json_last_error() !== JSON_ERROR_NONE) {
    die("JSON Error: " . json_last_error_msg());
}

// Debug: Print the entire JSON structure
echo "<pre>";
var_dump($data);
echo "</pre>";

// Stop execution to inspect the output
die();
