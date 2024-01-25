// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
echidna-test TestEchidna.sol --contract TestCounter
*/
contract Counter {
    uint public count;

    function inc() external {
        count += 1;
    }

    function dec() external {
        count -= 1;
    }
}

contract TestCounter is Counter {
    function echidna_test_true() public view returns (bool) {
        return true;
    }

    function echidna_test_false() public view returns (bool) {
        return false;
    }

    function echidna_test_count() public view returns (bool) {
        return count <= 5;
    }
}
