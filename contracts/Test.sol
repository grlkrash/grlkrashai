// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Test {
    string public message;

    constructor() {
        message = "Hello GRLKRASH!";
    }

    function setMessage(string memory _message) public {
        message = _message;
    }
} 